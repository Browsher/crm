"""Daily local prospecting campaign; uses the installed kit and preserves full exports."""
import argparse
import concurrent.futures
import csv
import hashlib
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.request
import html
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import unquote_plus

HERE = Path(os.environ.get("PROSPECCAO_CAMPANHA_DIR") or Path(__file__).resolve().parent).expanduser().resolve()
ROOT = HERE.parent
TZ = timezone(timedelta(hours=-3))
CONFIG = json.loads((HERE / "campanha.json").read_text(encoding="utf-8-sig"))
ESTADOS = dict(zip(
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(),
    ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
     "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
     "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
     "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"]))
UFS = set(ESTADOS)
HISTORY = HERE / "historico.json"
NODE = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
ENV = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")

def normal(value):
    return " ".join(unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode().lower().split())

def safe_slug(value):
    slug = re.sub(r"[^a-z0-9]+", "-", normal(value)).strip("-")
    if not slug:
        raise RuntimeError("Bairro e cidade precisam conter um nome válido")
    if len(slug) > 60:
        slug = slug[:60].rstrip("-") + "-" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return slug

def campaign_output(path):
    root = (HERE / "coletas").resolve()
    resolved = path.resolve()
    if resolved == root or not resolved.is_relative_to(root):
        raise RuntimeError("A saída da coleta precisa ficar dentro de coletas")
    return resolved

def same_pending_region(pending, bairro, cidade, uf):
    # Histories created before region selection contain only bairro/saida.
    return (normal(pending.get("bairro")) == normal(bairro)
        and normal(pending.get("cidade", "São Paulo")) == normal(cidade)
        and pending.get("uf", "SP").upper() == uf)

def read_json(path, default=None):
    return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else default

def save_json(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)

@contextmanager
def campaign_lock(state_path):
    if os.name == "nt":
        import msvcrt
    else:
        import fcntl
    state_path.parent.mkdir(parents=True,exist_ok=True)
    with state_path.with_suffix(".lock").open("a+b") as stream:
        if stream.seek(0,2)==0:
            stream.write(b"0");stream.flush()
        stream.seek(0)
        try:
            if os.name == "nt":
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError("Outra execução está em andamento; histórico preservado") from error
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:
                fcntl.flock(stream.fileno(),fcntl.LOCK_UN)

def keys(row):
    result = [f"{field}:{row[field]}" for field in ["place_id", "cid", "data_id"] if row.get(field)]
    result.append("endereco:" + normal(row.get("title")) + "|" + normal(row.get("address")))
    return result

def inspect_site(row):
    site = row.get("website", "")
    result = {"url": site, "emails": [], "texto": "", "erro": ""}
    if not site:
        return result
    try:
        request = urllib.request.Request(site, headers={"User-Agent": "Mozilla/5.0 (compatible; PesquisaComercialLocal/1.0)"})
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read(800_000)
            text = body.decode(response.headers.get_content_charset() or "utf-8", "replace")
            result["url"] = response.geturl()
            result["sha256"] = hashlib.sha256(body).hexdigest()
        without_code = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", text, flags=re.I | re.S)
        visible = html.unescape(re.sub(r"<[^>]+>", " ", without_code))
        # Store only matched catalog categories, not a copy of website prose.
        result["texto"] = " | ".join(term for term in ["utilidades domesticas","utensilios de cozinha","utilidades para casa","brinquedos","pelucias","loja de variedades","presentes"] if term in normal(visible))
        candidates = re.findall(r"[\w.%+\-]+@[\w.\-]+\.[A-Za-z]{2,}", visible)
        candidates += re.findall(r"mailto:([^\s\"'<>?]+)", html.unescape(text), re.I)
        for encoded in re.findall(r'data-cfemail=[\"\']([0-9a-f]+)', text, re.I):
            raw = bytes.fromhex(encoded)
            if raw:
                candidates.append("".join(chr(n ^ raw[0]) for n in raw[1:]))
        result["emails"] = sorted({e.lower().strip(".;,") for e in candidates if re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", e) and e.lower().split("@")[-1] not in {"example.com", "example.org", "email.com", "dominio.com", "seudominio.com"} and not e.lower().endswith((".png", ".jpg", ".webp", ".svg", "sentry.io", "wixpress.com"))})
    except Exception as error:
        result["erro"] = type(error).__name__ + ": " + str(error)[:180]
    return result

def profile(row, evidence):
    label = normal(row.get("title", "") + " " + row.get("category", ""))
    category = normal(row.get("category", ""))
    site = normal(evidence.get("texto", ""))
    product_terms = ["utilidades domesticas", "utensilios de cozinha", "utilidades para casa", "brinquedos", "pelucias", "loja de variedades", "presentes"]
    found = [term for term in product_terms if term in site]
    review=CONFIG.get("revisoes",{}).get(row.get("place_id"))
    if review:
        return "A conferir",review["motivo"]+"; fonte: "+review["fonte"],8
    if any(term in label for term in ["bazar da igreja","beneficente","brecho","solidario","supermercado"]):
        return "A conferir", "Bazar social/usados ou categoria conflitante; compra de mercadoria nova para revenda não confirmada",8
    incompatible = any(term in category for term in ["restaurante", "hotel", "confeccao", "loja de roupas", "oficina mecanica", "salão", "salao de beleza", "fornecedor de tecidos", "loja de tecidos"])
    if incompatible and not found:
        return "Fora do perfil", "Categoria sem evidência de revenda das linhas do catálogo", 9
    if "armarinho" in label and found:
        return "Armarinho de variedades", "Site publica: " + ", ".join(found), 0
    if any(term in label for term in ["utilidade", "variedade", "bazar"]):
        return "Utilidades/variedades/bazar", "Nome/categoria compatíveis" + ("; site publica: " + ", ".join(found) if found else "; mix de produtos a confirmar"), 1
    if "brinqued" in label:
        return "Brinquedos/presentes", "Nome/categoria de brinquedos; itens antistress do catálogo a confirmar", 2
    if found:
        return "Revenda com linhas compatíveis", "Site publica: " + ", ".join(found), 3
    return "A conferir", "Não foi confirmada venda de utilidades, brinquedos ou variedades", 8

def process(raw_path, query_map, bairro, state_path, output, limit=50, export=True, cidade="São Paulo", uf="SP", fila_planejada=False):
    with raw_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        original_fields = reader.fieldnames or []
        rows = list(reader)
    if not rows:
        raise RuntimeError("Coleta vazia; histórico e fila preservados para nova tentativa")
    for row in rows:
        if row.get("input_id") not in query_map:
            raise RuntimeError("Termo não identificado: " + str(row.get("input_id")))
    state = read_json(state_path, {"proximo_indice": 0, "vistos": {}, "execucoes": []})
    seen = state["vistos"]
    output.mkdir(parents=True, exist_ok=True)
    uniques = []
    index = {}
    for row in rows:
        row_keys = keys(row)
        existing = next((index[key] for key in row_keys if key in index), None)
        if existing is not None:
            existing["_termos"].add(query_map[row["input_id"]])
            existing["_n"] += 1
            continue
        row = dict(row, _termos={query_map[row["input_id"]]}, _n=1)
        uniques.append(row)
        for key in row_keys:
            index[key] = row
    cached = read_json(output / "fontes_sites.json", {})
    to_visit = []
    for row in uniques:
        if row.get("website") and keys(row)[0] not in cached:
            to_visit.append(row)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for row, evidence in zip(to_visit, executor.map(inspect_site, to_visit)):
            cached[keys(row)[0]] = evidence
    # Keep factual extraction and source URLs; full website copy is not an output.
    save_json(output / "fontes_sites.json", cached)
    now = datetime.now(TZ).isoformat()
    prepared = []
    for row in uniques:
        address = json.loads(row.get("complete_address") or "{}")
        row_keys = keys(row)
        known = any(seen.get(key,{}).get("selecionada",False) for key in row_keys)
        evidence = cached.get(row_keys[0], {})
        group, reason, rank = profile(row, evidence)
        closed = any(word in normal(row.get("status")) for word in ["permanently closed", "temporarily closed", "fechado permanentemente", "fechado temporariamente", "encerrado"])
        prepared.append({"nome_empresa":row.get("title", ""), "categoria":row.get("category", ""), "telefone":row.get("phone", ""), "email":"; ".join(evidence.get("emails", [])), "site":row.get("website", ""), "endereco":row.get("address", ""), "bairro":address.get("borough", ""), "cep":address.get("postal_code", ""), "cidade":address.get("city", ""), "link_maps":row.get("link", ""), "termo_pesquisado":" | ".join(sorted(row["_termos"])), "data_coleta":now[:10], "cnpj":"", "razao_social":"", "perfil":group, "motivo_aderencia":reason, "situacao_empresa":"Fechamento sinalizado no Maps" if closed else "Funcionamento individual não confirmado", "situacao_historico":"Já coletada anteriormente" if known else "Nova no histórico", "fonte_email":evidence.get("url", "") if evidence.get("emails") else "", "emails_motor_nao_reconfirmados":row.get("emails", ""), "observacoes":evidence.get("erro", "") or "Compra por caixa, volume e recorrência a qualificar.", "place_id":row.get("place_id", ""), "cid":row.get("cid", ""), "data_id":row.get("data_id", ""), "latitude":row.get("latitude", ""), "longitude":row.get("longitude", ""), "ocorrencias_brutas":str(row["_n"]), "_eligible":not known and not closed and rank<8, "_rank":rank, "_keys":row_keys})
    prepared.sort(key=lambda row: (not row["_eligible"], row["_rank"], normal(row["nome_empresa"])))
    selected = [row for row in prepared if row["_eligible"]][:limit]
    fields = [key for key in prepared[0] if not key.startswith("_")]
    raw_rows = [dict(row, termo_pesquisado=query_map[row["input_id"]],data_coleta=now[:10]) for row in rows]
    data = {"fields":fields, "selected":selected, "all":prepared, "raw_fields":original_fields+["termo_pesquisado","data_coleta"], "raw_rows":raw_rows, "output_files":{"selected":"empresas_novas.csv","all":"empresas_sinalizadas.csv","raw":"bruto_completo.csv"}}
    save_json(output / "dados_preparados.json", data)
    if export:
        command = [str(NODE), str(ROOT / "exportar_csv.mjs"), str(output)]
        result = subprocess.run(command, cwd=str(ROOT), env=ENV, capture_output=True, text=True, encoding="utf-8", timeout=180)
        if result.returncode:
            raise RuntimeError("Falha na exportação: " + result.stderr[-1000:])
    else:
        # Fixture-only intermediate serializer; daily outputs use the shared artifact exporter.
        for filename, file_fields, file_rows in [("empresas_novas.csv",fields,selected),("empresas_sinalizadas.csv",fields,prepared),("bruto_completo.csv",data["raw_fields"],raw_rows)]:
            with (output/filename).open("w",encoding="utf-8-sig",newline="") as stream:
                writer=csv.DictWriter(stream,fieldnames=file_fields,extrasaction="ignore");writer.writeheader();writer.writerows(file_rows)
    for filename, expected, expected_fields in [("empresas_novas.csv",selected,fields),("empresas_sinalizadas.csv",prepared,fields),("bruto_completo.csv",raw_rows,data["raw_fields"])]:
        payload=(output/filename).read_bytes()
        assert payload.startswith(b"\xef\xbb\xbf"), "Missing UTF-8 BOM"
        actual=list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
        assert len(actual)==len(expected)
        for got, original in zip(actual,expected):
            assert all(got[field]==str(original.get(field,"")) for field in expected_fields), "CSV changed original values"
    report={"bairro":bairro,"cidade":cidade,"uf":uf,"data":now[:10],"registros_brutos":len(rows),"empresas_unicas":len(prepared),"novas_selecionadas":len(selected),"meta":limit,"meta_atingida":len(selected)>=limit,"filtro_geografico":False,"ja_conhecidas":sum(r["situacao_historico"]!="Nova no histórico" for r in prepared),"novas_com_email":sum(bool(r["email"]) for r in selected),"saida":str(output),"verificacao":"CSVs reconciliados com as fontes; IDs e UTF-8 preservados"}
    save_json(output/"resumo.json",report)
    for row in prepared:
        for key in row["_keys"]:
            seen.setdefault(key,{"primeira_coleta":now[:10],"nome":row["nome_empresa"],"bairro":row["bairro"]})
            if row in selected:
                seen[key]["selecionada"]=True
    if not fila_planejada:
        state["proximo_indice"]+=1
    state["ultima_data_sucesso"]=now[:10]
    state["execucoes"].append(report)
    state.pop("pendente",None)
    save_json(state_path,state)
    return report

def load_kit():
    os.environ["SCRAPER_BASE_URL"]=CONFIG["base_url"]
    spec=importlib.util.spec_from_file_location("kit",ROOT/"google-maps-scraper-kit/scripts/scrape.py")
    kit=importlib.util.module_from_spec(spec);spec.loader.exec_module(kit)
    return kit

def collect(output, bairro, pilot=False, cidade="São Paulo", uf="SP"):
    kit=load_kit()
    output.mkdir(parents=True,exist_ok=True)
    terms=CONFIG["termos"] if not pilot else ["armarinhos","loja de utilidades domésticas"]
    keywords=[f"{term} no bairro {bairro} {cidade} {uf}" for term in terms]
    meta=read_json(output/"job.json")
    if meta:
        if meta["request"]["keywords"]!=keywords:
            raise RuntimeError("A pasta contém outra busca; preservar seus dados e conferir job.json")
        started=datetime.fromisoformat(meta["started_at"])
        job_id=meta["id"]
        print(f"Retomando job existente: {job_id}",flush=True)
    else:
        jobs=json.loads(kit.req("GET","/api/v1/jobs")[1])
        if any(str(job.get("Status",job.get("status",""))).lower() in {"working","pending","queued"} for job in jobs):
            raise RuntimeError("Há uma coleta ativa no motor; não iniciar outra ao mesmo tempo")
        coords=kit.geocode(f"{bairro}, {cidade}, {uf}, Brasil")
        if not coords:
            raise RuntimeError("Geocodificação indisponível; fila preservada")
        started=datetime.now(timezone.utc)
        body={"name":"armarinhos-"+safe_slug(bairro)+"-"+safe_slug(cidade)+"-"+uf.lower()+"-"+started.strftime("%Y%m%d"),"keywords":keywords,"lang":"pt","zoom":15,"lat":coords[0],"lon":coords[1],"fast_mode":False,"radius":CONFIG["radius"],"depth":CONFIG["depth"],"email":not pilot,"max_time":CONFIG["max_time"] if not pilot else 420}
        job_id=json.loads(kit.req("POST","/api/v1/jobs",body)[1])["id"]
        meta={"id":job_id,"bairro":bairro,"cidade":cidade,"uf":uf,"request":body,"started_at":started.isoformat(),"exportacao":"--full: download original, todos os campos preservados"}
        save_json(output/"job.json",meta)
    print(f"Coletando {bairro}: {len(keywords)} termos; job {job_id}",flush=True)
    for attempt in range(110):
        detail=json.loads(kit.req("GET",f"/api/v1/jobs/{job_id}")[1]);meta["status"]=detail
        save_json(output/"job.json",meta)
        status=detail.get("Status",detail.get("status"))
        if status=="ok":
            break
        if status=="failed":
            raise RuntimeError("Motor sinalizou falha; fila não avançou. Consulte job.json")
        if attempt%6==0:
            print("Status:",status,flush=True)
        time.sleep(10)
    else:
        raise RuntimeError("Tempo de acompanhamento excedido; job e fila preservados")
    payload=kit.req("GET",f"/api/v1/jobs/{job_id}/download")[1]
    raw=output/"bruto_original_full.csv";raw.write_bytes(payload)
    meta["downloaded_at"]=datetime.now(TZ).isoformat();meta["sha256"]=hashlib.sha256(payload).hexdigest()
    save_json(output/"job.json",meta)
    logs=subprocess.run(["docker","logs","--since",started.isoformat(),"gmaps-mooca-prospeccao"],capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=60)
    text=logs.stdout+"\n"+logs.stderr
    (output/"motor.log").write_text(text,encoding="utf-8")
    mapping={}
    for line in text.splitlines():
        try:
            event=json.loads(line)
        except json.JSONDecodeError:
            continue
        match=re.search(r"ID: ([^,]+).*?maps/search/([^/]+)/@",event.get("job",""))
        if match:
            keyword=unquote_plus(match[2])
            if keyword in keywords:
                mapping[match[1]]=keyword
    save_json(output/"termos_por_input_id.json",mapping)
    return raw,mapping

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rodar",action="store_true")
    parser.add_argument("--piloto",action="store_true")
    parser.add_argument("--processar",type=Path)
    parser.add_argument("--mapa",type=Path)
    parser.add_argument("--bairro")
    parser.add_argument("--cidade",help="Município (padrão legado: São Paulo)")
    parser.add_argument("--uf",type=str.upper,choices=sorted(UFS),help="UF (padrão legado: SP)")
    parser.add_argument("--fila-planejada",action="store_true",help="Recebe bairro/cidade/UF explícitos e preserva o índice da fila legada")
    parser.add_argument("--estado",type=Path,default=HISTORY)
    parser.add_argument("--saida",type=Path)
    parser.add_argument("--limite",type=int,default=CONFIG["meta_diaria"])
    args=parser.parse_args()
    if not 1 <= args.limite <= 50:
        parser.error("--limite deve ficar entre 1 e 50")
    if args.fila_planejada and not all(value and value.strip() for value in (args.bairro,args.cidade,args.uf)):
        parser.error("--fila-planejada exige --bairro, --cidade e --uf explícitos")
    cidade=(args.cidade or "São Paulo").strip()
    uf=args.uf or "SP"
    safe_slug(cidade)
    if args.bairro:
        args.bairro=args.bairro.strip()
        safe_slug(args.bairro)
    if args.processar:
        if not all((args.bairro,args.mapa,args.saida)):
            parser.error("--processar exige --bairro, --mapa e --saida")
        report=process(args.processar,read_json(args.mapa,{}),args.bairro,args.estado,args.saida,args.limite,export=False,cidade=cidade,uf=uf,fila_planejada=args.fila_planejada)
    elif args.rodar or args.piloto:
        # Everything derived from history is selected again under the lock.
        # Explicit output validation precedes writing a pending entry.
        explicit_output=campaign_output(args.saida) if args.saida else None
        with campaign_lock(args.estado):
            current=read_json(args.estado,{"proximo_indice":0,"vistos":{},"execucoes":[]})
            if not args.piloto and current.get("ultima_data_sucesso")==datetime.now(TZ).date().isoformat():
                print("Já executada hoje; histórico preservado");return
            if not args.fila_planejada and current["proximo_indice"]>=len(CONFIG["bairros"]):
                print(json.dumps({"situacao":"Fila concluída","bairros":len(CONFIG["bairros"])},ensure_ascii=False));return
            bairro=args.bairro or CONFIG["bairros"][current["proximo_indice"]]
            name=datetime.now(TZ).strftime("%Y-%m-%d")+"_"+safe_slug(bairro)
            if args.fila_planejada:
                name+="_"+safe_slug(cidade)+"_"+uf.lower()
            if args.piloto:
                name+="_piloto"
            output=explicit_output or HERE/"coletas"/name
            pending=current.get("pendente",{})
            if not explicit_output and not args.piloto and same_pending_region(pending,bairro,cidade,uf):
                output=Path(pending["saida"])
            output=campaign_output(output)
            if not args.piloto:
                current["pendente"]={"bairro":bairro,"cidade":cidade,"uf":uf,"saida":str(output)}
                save_json(args.estado,current)
            raw,mapping=collect(output,bairro,args.piloto,cidade=cidade,uf=uf)
            report=process(raw,mapping,bairro,(output/"historico_piloto.json") if args.piloto else args.estado,output,args.limite,cidade=cidade,uf=uf,fila_planejada=args.fila_planejada)
    else:
        state=read_json(args.estado,{"proximo_indice":0,"vistos":{},"execucoes":[]})
        next_index=state["proximo_indice"]
        report={"campanha":CONFIG["nome"],"proximo_bairro":CONFIG["bairros"][next_index] if next_index<len(CONFIG["bairros"]) else None,"bairros_concluidos":next_index,"total_bairros":len(CONFIG["bairros"]),"empresas_no_historico":len({item["nome"] for item in state["vistos"].values()}),"horario":"Dias úteis às 9h - São Paulo"}
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":
    try:
        main()
    except Exception as error:
        print(str(error),file=sys.stderr)
        raise SystemExit(1)
