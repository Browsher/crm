"""Ponte do CRM para o motor e o validador existentes. Nenhuma coleta ao importar."""
import argparse
import csv
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote_plus


def sha256(arquivo):
    return hashlib.sha256(Path(arquivo).read_bytes()).hexdigest()


def consulta(pedido):
    return ' '.join(str(pedido[k]).strip() for k in ('nicho', 'bairro', 'cidade', 'uf') if str(pedido[k]).strip())


def verificar_inicio(pasta, pedido):
    intencao = pasta/'intencao.json'
    if intencao.exists() and not (pasta/'job.json').exists():
        raise RuntimeError('Reconcilie a criação pendente no motor antes de iniciar outro job; preserve intencao.json.')
    if (pasta/'pedido.json').exists():
        antigo = json.loads((pasta/'pedido.json').read_text(encoding='utf-8'))
        if antigo != pedido:
            raise RuntimeError('A pasta contém outro pedido ou critérios divergentes.')


def telefone(valor):
    limpo = re.sub(r'[\s().+\-]', '', str(valor or ''))
    if len(limpo) in (12, 13) and limpo.startswith('55'):
        limpo = limpo[2:]
    return limpo if re.fullmatch(r'[0-9]{10,11}', limpo) else ''


def normalizar(origem, validadas):
    por_id = {}
    for linha in validadas:
        chave = linha.get('google_place_id') or linha.get('place_id')
        if chave:
            por_id.setdefault(chave, []).append(linha)
    resultado = []
    for linha in origem:
        place = linha.get('google_place_id') or linha.get('place_id') or ''
        candidatos = por_id.get(place, [])
        fone = telefone(linha.get('telefone'))
        validado = bool(fone and any(telefone(r.get('telefone')) == fone for r in candidatos))
        resultado.append({'google_place_id': place or None, 'cnpj': linha.get('cnpj') or None,
            'razao_social': linha.get('razao_social') or None, 'nome_fantasia': linha.get('nome_fantasia') or linha.get('nome_empresa') or None,
            'telefone': fone, 'email': linha.get('email') or None, 'cep': re.sub(r'\D', '', str(linha.get('cep') or '')) or None,
            'endereco': linha.get('endereco') or '', 'categoria': linha.get('categoria') or '', 'site': linha.get('site') or '',
            'validado': validado, 'fechada': 'Fechamento sinalizado' in str(linha.get('situacao_empresa', '')),
            'dados_brutos': {k: v for k, v in linha.items() if not k.startswith('_')}})
    return resultado


def conferir_recibo(pedido, recibo, original, final):
    if recibo.get('pedido_id') != pedido['id'] or recibo.get('validacao_conferida') is not True:
        raise ValueError('Recibo não corresponde ao pedido ou à validação conferida.')
    if recibo.get('origem_sha256') != sha256(original) or recibo.get('final_sha256') != sha256(final):
        raise ValueError('O hash dos arquivos não corresponde ao recibo conferido.')
    if not all(isinstance(recibo.get(k), str) and 0 < len(recibo[k]) <= 255 for k in ('arquivo_original_id', 'arquivo_final_id')):
        raise ValueError('Recibo precisa identificar os dois arquivos confirmados no Drive.')


def carregar_coletor(campanha):
    campanha = Path(campanha).resolve()
    os.environ['PROSPECCAO_CAMPANHA_DIR'] = str(campanha)
    spec = importlib.util.spec_from_file_location('coletor_existente', campanha/'coletor.py')
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    if modulo.CONFIG['base_url'].rstrip('/') not in ('http://localhost:8087', 'http://127.0.0.1:8087'):
        raise ValueError('Confira o motor configurado na porta 8087 antes de continuar.')
    return modulo


def coletar(pedido, campanha):
    if not re.fullmatch(r'[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}', pedido.get('id', ''), re.I):
        raise ValueError('Identidade do pedido inválida.')
    if pedido.get('estado') != 'coletando':
        raise ValueError('Pedido não está em coleta. Reconcilie a etapa atual antes de continuar.')
    modulo = carregar_coletor(campanha)
    pasta = modulo.HERE/'coletas'/'crm'/pedido['id']
    pasta.mkdir(parents=True, exist_ok=True)
    with modulo.campaign_lock(modulo.HISTORY):
        verificar_inicio(pasta, pedido)
        modulo.save_json(pasta/'pedido.json', pedido)
        if (pasta/'dados_preparados.json').exists() and (pasta/'resumo.json').exists():
            return pasta
        kit = modulo.load_kit()
        meta = modulo.read_json(pasta/'job.json')
        termo = consulta(pedido)
        if not meta:
            jobs = json.loads(kit.req('GET', '/api/v1/jobs')[1])
            if any(str(j.get('Status', j.get('status', ''))).lower() in ('working', 'pending', 'queued') for j in jobs):
                raise RuntimeError('Há outra coleta ativa no motor. Preserve o pedido.')
            coords = kit.geocode(', '.join(v for v in (pedido['bairro'], pedido['cidade'], pedido['uf'], 'Brasil') if v))
            if not coords:
                raise RuntimeError('Geocodificação indisponível. Preserve o pedido.')
            inicio = datetime.now(timezone.utc).isoformat()
            body = {'name': 'crm-'+pedido['id'], 'keywords': [termo], 'lang': 'pt', 'zoom': 15, 'lat': coords[0], 'lon': coords[1],
                'fast_mode': False, 'email': True, 'radius': modulo.CONFIG['radius'], 'depth': modulo.CONFIG['depth'], 'max_time': modulo.CONFIG['max_time']}
            modulo.save_json(pasta/'intencao.json', {'pedido_id': pedido['id'], 'request': body, 'started_at': inicio})
            resposta = json.loads(kit.req('POST', '/api/v1/jobs', body)[1])
            meta = {'id': resposta['id'], 'request': body, 'started_at': inicio, 'pedido_id': pedido['id']}
            modulo.save_json(pasta/'job.json', meta)
        if meta.get('pedido_id') != pedido['id'] or meta['request']['keywords'] != [termo]:
            raise RuntimeError('Job divergente. Preserve a pasta para conferência.')
        raw = pasta/'bruto_original_full.csv'
        if not raw.exists():
            for _ in range(110):
                status = json.loads(kit.req('GET', '/api/v1/jobs/'+meta['id'])[1])
                estado = status.get('Status', status.get('status'))
                if estado == 'ok':
                    break
                if estado == 'failed':
                    raise RuntimeError('Motor sinalizou falha. Reconcilie o mesmo job.')
                time.sleep(10)
            else:
                raise RuntimeError('Acompanhamento excedido. Retome o mesmo job.')
            raw.write_bytes(kit.req('GET', '/api/v1/jobs/'+meta['id']+'/download')[1])
        mapa = modulo.read_json(pasta/'termos_por_input_id.json')
        if mapa is None:
            logs = subprocess.run(['docker', 'logs', '--since', meta['started_at'], 'gmaps-mooca-prospeccao'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, check=True)
            texto = logs.stdout+'\n'+logs.stderr
            (pasta/'motor.log').write_text(texto, encoding='utf-8')
            mapa = {}
            for linha in texto.splitlines():
                try:
                    evento = json.loads(linha)
                except json.JSONDecodeError:
                    continue
                match = re.search(r'ID: ([^,]+).*?maps/search/([^/]+)/@', evento.get('job', ''))
                if match and unquote_plus(match[2]) == termo:
                    mapa[match[1]] = termo
            modulo.save_json(pasta/'termos_por_input_id.json', mapa)
        modulo.CONFIG['termos'] = [pedido['nicho']]
        modulo.profile = lambda row, evidence: ('Nicho solicitado', 'Aderência comercial a conferir pelo vendedor.', 0)
        modulo.process(raw, mapa, pedido['bairro'], pasta/'historico.json', pasta, 50,
            cidade=pedido['cidade'], uf=pedido['uf'], fila_planejada=True)
        return pasta


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('acao', choices=('coletar', 'preparar'))
    parser.add_argument('--pedido', required=True)
    parser.add_argument('--campanha')
    parser.add_argument('--coletadas')
    parser.add_argument('--final')
    parser.add_argument('--original')
    parser.add_argument('--recibo')
    parser.add_argument('--saida')
    args = parser.parse_args()
    pedido = json.loads(Path(args.pedido).read_text(encoding='utf-8-sig'))
    if args.acao == 'coletar':
        if not args.campanha:
            parser.error('--campanha é obrigatório')
        print(coletar(pedido, args.campanha))
        return
    if not all((args.coletadas, args.final, args.original, args.recibo, args.saida)):
        parser.error('preparar exige --coletadas, --original, --final, --recibo e --saida')
    recibo = json.loads(Path(args.recibo).read_text(encoding='utf-8-sig'))
    conferir_recibo(pedido, recibo, args.original, args.final)
    dados = json.loads(Path(args.coletadas).read_text(encoding='utf-8-sig'))
    with Path(args.final).open(encoding='utf-8-sig', newline='') as stream:
        validadas = list(csv.DictReader(stream))
    origem = dados['all']
    if len(origem) > 50:
        raise ValueError('O motor retornou mais de 50 empresas. Preserve o arquivo completo e confira o lote antes de publicar.')
    publicacao = {'acao': 'entregar', 'pedido': pedido['id'], 'empresas': normalizar(origem, validadas), 'recibo': recibo}
    saida = Path(args.saida)
    conteudo = json.dumps(publicacao, ensure_ascii=False, indent=2)
    if saida.exists() and saida.read_text(encoding='utf-8') != conteudo:
        raise ValueError('Arquivo de publicação existente diverge. Preserve-o para reconciliação.')
    saida.write_text(conteudo, encoding='utf-8')
    print(str(saida))


if __name__ == '__main__':
    main()
