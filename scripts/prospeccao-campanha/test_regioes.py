"""Region selection tests. Fake API/export boundaries; no Maps or site requests."""
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import quote_plus
from test_suporte import SOURCE, STAGE, coletor, fixture_rows, write_raw, fixture_export

class SelectedRegion(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=STAGE,prefix="regiao_")
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(STAGE))
        self.state=self.root/"historico.json"
        self.raw=write_raw(self.root/"raw.csv",fixture_rows())
        self.requests=[]
        self.geocodes=[]
        self.created=[]
        self.status="ok"
        self.addCleanup(patch.stopall)
        patch.object(coletor,"HERE",self.root).start()
        patch.object(coletor,"HISTORY",self.state).start()
        patch.object(coletor.urllib.request,"urlopen",side_effect=AssertionError("Acesso externo proibido")).start()
        patch.object(coletor,"load_kit",return_value=SimpleNamespace(req=self.request,geocode=self.geocode)).start()
        patch.object(coletor.subprocess,"run",side_effect=self.external_process).start()

    def geocode(self, address):
        self.geocodes.append(address)
        return (-23.45,-46.53)

    def request(self, method, path, body=None):
        self.requests.append((method,path))
        if method=="GET" and path=="/api/v1/jobs":return 200,b"[]"
        if method=="POST" and path=="/api/v1/jobs":
            self.created.append(body)
            return 200,b'{"id":"synthetic-job"}'
        if method=="GET" and path.endswith("/download"):return 200,self.raw.read_bytes()
        if method=="GET" and path in {"/api/v1/jobs/synthetic-job","/api/v1/jobs/existing-job"}:
            return 200,json.dumps({"Status":self.status}).encode()
        raise AssertionError("API inesperada: "+method+" "+path)

    def external_process(self, command, **options):
        if command[0]=="docker":
            if self.created: keyword=self.created[-1]["keywords"][0]
            else: keyword=self.resume_keywords[0]
            text=json.dumps({"job":"ID: q1, maps/search/"+quote_plus(keyword)+"/@"})
            return SimpleNamespace(returncode=0,stdout=text,stderr="")
        fixture_export(Path(command[-1]))
        return SimpleNamespace(returncode=0,stdout="",stderr="")

    def run_cli(self, *args):
        stdout,stderr=io.StringIO(),io.StringIO()
        with patch.object(sys,"argv",["coletor.py","--estado",str(self.state),*map(str,args)]),redirect_stdout(stdout),redirect_stderr(stderr):
            try:coletor.main()
            except SystemExit as error:return error.code,stdout.getvalue()+stderr.getvalue()
            except RuntimeError as error:return 1,str(error)
        return 0,stdout.getvalue()

    def planned(self, *extra, bairro="Centro", cidade="Guarulhos", uf="SP"):
        return self.run_cli("--rodar","--fila-planejada","--bairro",bairro,"--cidade",cidade,"--uf",uf,*extra)

    def saved(self):return json.loads(self.state.read_text(encoding="utf-8"))
    def report(self):return self.saved()["execucoes"][-1]
    def selected(self):
        with (Path(self.report()["saida"])/"empresas_novas.csv").open(encoding="utf-8-sig",newline="") as stream:return list(csv.DictReader(stream))

    def pending(self, cidade="Guarulhos", uf="SP", legacy=False, output=None):
        folder=output or self.root/"coletas"/"coleta_anterior"
        folder.mkdir(parents=True,exist_ok=True)
        self.resume_keywords=[f"{term} no bairro Centro {cidade} {uf}" for term in coletor.CONFIG["termos"]]
        coletor.save_json(folder/"job.json",{"id":"existing-job","request":{"keywords":self.resume_keywords},"started_at":"2026-10-15T12:00:00+00:00"})
        item={"bairro":"Centro","saida":str(folder)}
        if not legacy:item.update(cidade=cidade,uf=uf)
        coletor.save_json(self.state,{"proximo_indice":25,"vistos":{},"execucoes":[],"pendente":item})
        return folder

    def test_selected_city_controls_search_geocode_filter_and_summary(self):
        rows=fixture_rows()+fixture_rows(cidade="São Paulo")
        rows[1]["place_id"]="outside-city";rows[1]["cid"]="00000000000000002";rows[1]["title"]="Utilidades fora"
        write_raw(self.raw,rows)
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertEqual(self.geocodes,["Centro, Guarulhos, SP, Brasil"])
        self.assertEqual(self.created[0]["keywords"][0],"armarinhos no bairro Centro Guarulhos SP")
        self.assertEqual([row["place_id"] for row in self.selected()],["id1"])
        self.assertEqual((self.report()["cidade"],self.report()["uf"]),("Guarulhos","SP"))
        self.assertEqual(self.saved()["proximo_indice"],0)

    def test_address_state_disambiguates_homonymous_cities_when_available(self):
        rows=fixture_rows(cidade="Bom Jesus",uf="RS")+fixture_rows(cidade="Bom Jesus",uf="PI")
        rows[0]["complete_address"]=json.dumps(dict(borough="Centro",city="Bom Jesus",state="Rio Grande do Sul"))
        rows[1]["place_id"]="other-state";rows[1]["cid"]="00000000000000002";rows[1]["title"]="Utilidades fora"
        write_raw(self.raw,rows)
        code,text=self.planned(cidade="Bom Jesus",uf="RS")
        self.assertEqual(code,0,text)
        self.assertEqual([row["place_id"] for row in self.selected()],["id1"])

    def test_job_keywords_for_another_region_are_rejected_before_any_request(self):
        folder=self.pending()
        job=json.loads((folder/"job.json").read_text(encoding="utf-8"))
        job["request"]["keywords"]=["armarinhos no bairro Centro Campinas SP"]
        coletor.save_json(folder/"job.json",job)
        code,text=self.planned()
        self.assertNotEqual(code,0)
        self.assertEqual(self.requests,[])
        self.assertEqual(job,json.loads((folder/"job.json").read_text(encoding="utf-8")))

    def test_external_queue_collects_after_25_without_advancing_legacy_index(self):
        coletor.save_json(self.state,{"proximo_indice":25,"vistos":{},"execucoes":[]})
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertEqual(self.report()["novas_selecionadas"],1)
        self.assertEqual(self.saved()["proximo_indice"],25)

    def test_planned_resume_same_region_reuses_job_and_old_folder(self):
        folder=self.pending()
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertEqual(Path(self.report()["saida"]),folder)
        self.assertEqual(self.created,[])
        self.assertIn(("GET","/api/v1/jobs/existing-job/download"),self.requests)

    def test_homonymous_neighborhood_in_other_city_does_not_reuse_pending_job(self):
        previous=self.pending(cidade="São Paulo")
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertNotEqual(Path(self.report()["saida"]),previous)
        self.assertEqual(len(self.created),1)
        self.assertTrue((previous/"job.json").exists())

    def test_homonymous_city_in_another_state_does_not_reuse_pending_job(self):
        previous=self.pending(cidade="Bom Jesus",uf="PI")
        write_raw(self.raw,fixture_rows(cidade="Bom Jesus",uf="RS"))
        code,text=self.planned(cidade="Bom Jesus",uf="RS")
        self.assertEqual(code,0,text)
        self.assertNotEqual(Path(self.report()["saida"]),previous)
        self.assertEqual(self.geocodes,["Centro, Bom Jesus, RS, Brasil"])
        self.assertEqual(len(self.created),1)

    def test_legacy_pending_without_city_is_not_used_for_other_city(self):
        previous=self.pending(cidade="São Paulo",legacy=True)
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertNotEqual(Path(self.report()["saida"]),previous)
        self.assertEqual(len(self.created),1)

    def test_failed_collection_keeps_full_region_pending_and_can_resume(self):
        self.status="failed"
        code,text=self.planned()
        self.assertEqual(code,1,text)
        pending=self.saved()["pendente"]
        self.assertEqual((pending["bairro"],pending["cidade"],pending["uf"]),("Centro","Guarulhos","SP"))
        self.assertEqual(self.saved()["proximo_indice"],0)
        self.status="ok"
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertEqual(len(self.created),1)
        self.assertEqual(self.saved()["proximo_indice"],0)
        self.assertNotIn("pendente",self.saved())

    def test_planned_output_contains_safe_city_and_uf_inside_coletas(self):
        bairro='../../Centro\\sub:teste?*'
        cidade='../Guarulhos<>|"'
        write_raw(self.raw,fixture_rows(bairro=bairro,cidade=cidade))
        code,text=self.planned(bairro=bairro,cidade=cidade)
        self.assertEqual(code,0,text)
        folder=Path(self.report()["saida"]).resolve()
        self.assertEqual(folder.parent,self.root/"coletas")
        self.assertRegex(folder.name,r"^\d{4}-\d{2}-\d{2}_centro-sub-teste_guarulhos_sp$")

    def test_unsafe_pending_path_is_rejected_before_api_or_history_change(self):
        outside=self.root/"fora_de_coletas"
        self.pending(output=outside)
        original=self.state.read_bytes()
        code,text=self.planned()
        self.assertNotEqual(code,0)
        self.assertIn("coletas",text)
        self.assertEqual(self.requests,[])
        self.assertEqual(self.state.read_bytes(),original)

    def test_unsafe_explicit_output_is_rejected_before_api(self):
        code,text=self.planned("--saida",self.root/"fora_de_coletas")
        self.assertNotEqual(code,0)
        self.assertIn("coletas",text)
        self.assertEqual(self.requests,[])
        self.assertFalse(self.state.exists())

    def test_planned_region_is_explicit_and_uf_must_be_brazilian(self):
        for args in [("--cidade","Guarulhos","--uf","SP"),("--bairro","Centro","--uf","SP"),("--bairro","Centro","--cidade","Guarulhos"),("--bairro","Centro","--cidade","Guarulhos","--uf","ZZ")]:
            with self.subTest(args=args):
                code,text=self.run_cli("--rodar","--fila-planejada",*args)
                self.assertNotEqual(code,0)
                self.assertEqual(self.requests,[])
        self.assertFalse(self.state.exists())

    def test_region_without_safe_name_is_rejected_before_api(self):
        code,text=self.planned(bairro="../..")
        self.assertNotEqual(code,0)
        self.assertEqual(self.requests,[])
        self.assertFalse(self.state.exists())

    def test_daily_limit_caps_at_50_and_another_run_creates_no_job(self):
        write_raw(self.raw,fixture_rows(count=52))
        code,text=self.planned()
        self.assertEqual(code,0,text)
        self.assertEqual(len(self.selected()),50)
        calls=len(self.requests)
        code,text=self.planned(cidade="Campinas")
        self.assertEqual(code,0,text)
        self.assertEqual(len(self.requests),calls)
        self.assertEqual(len(self.saved()["execucoes"]),1)

    def test_limit_above_50_is_rejected_before_api(self):
        code,text=self.planned("--limite","51")
        self.assertNotEqual(code,0)
        self.assertEqual(self.requests,[])
        self.assertFalse(self.state.exists())

    def test_legacy_defaults_keep_sao_paulo_fixed_queue_and_folder(self):
        write_raw(self.raw,fixture_rows(bairro="Brás",cidade="São Paulo"))
        code,text=self.run_cli("--rodar")
        self.assertEqual(code,0,text)
        self.assertEqual(self.geocodes,["Brás, São Paulo, SP, Brasil"])
        self.assertEqual(self.saved()["proximo_indice"],1)
        self.assertEqual(Path(self.report()["saida"]).name,datetime.now(coletor.TZ).strftime("%Y-%m-%d")+"_bras")

    def test_configured_campaign_directory_works_without_copying_script(self):
        # The actual source directory intentionally has no campanha.json/history.
        environment=dict(os.environ,PROSPECCAO_CAMPANHA_DIR=str(STAGE),PYTHONUTF8="1")
        # subprocess.run is patched for external boundaries; use Popen only here.
        process=subprocess.Popen([sys.executable,str(SOURCE/"coletor.py")],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=environment)
        stdout,stderr=process.communicate(timeout=30)
        self.assertEqual(process.returncode,0,stderr.decode("utf-8"))
        self.assertIn("Campanha de exemplo",stdout.decode("utf-8"))

class SummaryVerification(unittest.TestCase):
    def test_verifier_accepts_city_from_summary(self):
        self.check_city("Guarulhos", "Guarulhos")

    def test_verifier_uses_same_city_normalization_as_eligibility(self):
        self.check_city("Sao Bernardo do Campo", "São Bernardo do Campo")

    def test_verifier_preserves_equivalent_neighborhood_spelling(self):
        for spelling in ("Se", " SÉ ", "sé"):
            with self.subTest(bairro=spelling):
                self.check_city("São Paulo", "São Paulo", actual_bairro=spelling, requested_bairro="Sé")

    def test_verifier_still_rejects_another_neighborhood(self):
        self.check_city("São Paulo", "São Paulo", actual_bairro="Liberdade", requested_bairro="Sé", accepted=False)

    def check_city(self, actual_city, requested_city, actual_bairro="Centro", requested_bairro="Centro", accepted=True):
        with tempfile.TemporaryDirectory(dir=STAGE,prefix="verificador_") as temp:
            folder=Path(temp)
            rows=fixture_rows(bairro=actual_bairro,cidade=actual_city)
            write_raw(folder/"bruto_original_full.csv",rows)
            raw_fields=list(rows[0])+["termo_pesquisado","data_coleta"]
            augmented=[dict(rows[0],termo_pesquisado="utilidades Centro Guarulhos SP",data_coleta="2026-10-16")]
            chosen=dict(nome_empresa="Utilidades 1",endereco="Rua Teste, 1",bairro=actual_bairro,cidade=actual_city,perfil="Utilidades/variedades/bazar",situacao_empresa="Funcionamento individual não confirmado",termo_pesquisado="utilidades Centro Guarulhos SP",data_coleta="2026-10-16",email="",telefone="",fonte_email="",place_id="id1",cid="123456789012345671",data_id="",ocorrencias_brutas="1")
            data=dict(fields=list(chosen),selected=[chosen],all=[chosen],raw_fields=raw_fields,raw_rows=augmented)
            coletor.save_json(folder/"dados_preparados.json",data)
            fixture_export(folder)
            coletor.save_json(folder/"fontes_sites.json",{})
            coletor.save_json(folder/"resumo.json",dict(bairro=requested_bairro,cidade=requested_city,uf="SP",data="2026-10-16",meta=50,novas_selecionadas=1,registros_brutos=1))
            coletor.save_json(folder/"job.json",dict(sha256=hashlib.sha256((folder/"bruto_original_full.csv").read_bytes()).hexdigest()))
            result=subprocess.run([sys.executable,str(SOURCE/"verificar_coleta.py"),str(folder)],capture_output=True,text=True,encoding="utf-8")
            if accepted:
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(json.loads((folder/"verificacao.json").read_text(encoding="utf-8"))["empresas_selecionadas"],1)
                with (folder/"empresas_novas.csv").open(encoding="utf-8-sig",newline="") as stream:
                    self.assertEqual(next(csv.DictReader(stream))["bairro"],actual_bairro)
            else:
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((folder/"verificacao.json").exists())

if __name__=="__main__":unittest.main()
