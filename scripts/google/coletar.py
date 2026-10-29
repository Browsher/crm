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
from contextlib import ExitStack
from decimal import Decimal, InvalidOperation
from motores import carregar_motor, travar_motor, travar_execucao, geocodificar_com_cache
from pathlib import Path
from urllib.parse import unquote_plus
from rodadas import priorizar, identidades
from consultas import areas_ativas, opcao_booleana, gerar_consultas, conferir_consultas


def sha256(arquivo):
    return hashlib.sha256(Path(arquivo).read_bytes()).hexdigest()


def consulta(pedido):
    partes = [str(pedido[k]).strip() for k in ('nicho', 'bairro', 'cidade', 'uf') if str(pedido[k]).strip()]
    if pedido.get('contrato') == 2 and pedido.get('criterios', {}).get('termos'):
        partes.append(pedido['criterios']['termos'])
    return ' '.join(partes)


def contexto_operacional(pedido):
    return {'pedido_id': pedido['id'], 'motor': pedido.get('motor', '01'), 'criterios': {k: pedido[k] for k in ('nicho', 'bairro', 'cidade', 'uf')},
        'bairro': pedido['bairro'] or 'Cidade inteira', 'cidade': pedido['cidade'], 'uf': pedido['uf']}


def verificar_inicio(pasta, pedido, permitir_intencao=False):
    intencao = pasta/'intencao.json'
    if intencao.exists() and not (pasta/'job.json').exists() and not permitir_intencao:
        raise RuntimeError('Reconcilie a criação pendente no motor antes de iniciar outro job; preserve intencao.json.')
    for nome in ('pedido.json','job.json','intencao.json'):
        arquivo = pasta/nome
        if arquivo.exists():
            dados = json.loads(arquivo.read_text(encoding='utf-8'))
            if dados.get('motor','01') != pedido.get('motor','01'):
                raise RuntimeError('A pasta pertence a outro motor. Preserve os arquivos.')
    if (pasta/'pedido.json').exists():
        antigo = json.loads((pasta/'pedido.json').read_text(encoding='utf-8'))
        imutaveis = ('id', 'vendedor_id', 'dia', 'nicho', 'bairro', 'cidade', 'uf', 'snapshot')
        metadados = ('executor', 'revisao', 'execucao_id', 'snapshot_sha256', 'criterios', 'rodada')
        if any(antigo.get(k) != pedido.get(k) for k in imutaveis) or any(k in antigo and antigo[k] != pedido.get(k) for k in metadados):
            raise RuntimeError('A pasta contém outro pedido ou critérios divergentes.')


def pasta_do_pedido(raiz, pedido):
    formato = r'[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}'
    if not all(re.fullmatch(formato, str(pedido.get(k, '')), re.I) for k in ('id', 'vendedor_id')):
        raise ValueError('Identidade do vendedor ou pedido inválida.')
    antiga = raiz/'coletas'/'crm'/pedido['id']
    if pedido.get('contrato') == 2:
        if not re.fullmatch(formato, str(pedido.get('execucao_id', '')), re.I) or type(pedido.get('rodada', 1)) is not int or not 1 <= pedido.get('rodada', 1) <= 3:
            raise ValueError('Identidade da execução ou rodada inválida.')
        return raiz/'coletas'/'agentes'/pedido['vendedor_id']/pedido['id']/pedido['execucao_id']/('coleta-%02d' % pedido.get('rodada', 1))
    return antiga if antiga.exists() else raiz/'coletas'/'agentes'/pedido['vendedor_id']/pedido['id']


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
    if recibo.get('versao') == 2:
        if pedido.get('contrato') != 2 or any(recibo.get(k) != pedido.get(k) for k in ('execucao_id', 'revisao', 'snapshot_sha256')) or recibo.get('pedido_id') != pedido['id']:
            raise ValueError('Recibo diverge do snapshot da execução.')
        if recibo.get('origem_sha256') != sha256(original) or recibo.get('resultado_sha256') != sha256(final):
            raise ValueError('O hash dos arquivos não corresponde ao recibo da rodada.')
        if not all(isinstance(recibo.get(k), str) and 0 < len(recibo[k]) <= 255 for k in ('arquivo_original_id', 'arquivo_resultado_id')):
            raise ValueError('Recibo precisa identificar os arquivos originais e de resultado no Drive.')
        return
    if recibo.get('pedido_id') != pedido['id'] or recibo.get('validacao_conferida') is not True:
        raise ValueError('Recibo não corresponde ao pedido ou à validação conferida.')
    if recibo.get('origem_sha256') != sha256(original) or recibo.get('final_sha256') != sha256(final):
        raise ValueError('O hash dos arquivos não corresponde ao recibo conferido.')
    if not all(isinstance(recibo.get(k), str) and 0 < len(recibo[k]) <= 255 for k in ('arquivo_original_id', 'arquivo_final_id')):
        raise ValueError('Recibo precisa identificar os dois arquivos confirmados no Drive.')


def carregar_coletor(campanha, motor_id='01'):
    campanha = Path(campanha).resolve()
    os.environ['PROSPECCAO_CAMPANHA_DIR'] = str(campanha)
    spec = importlib.util.spec_from_file_location('coletor_existente', campanha/'coletor.py')
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    if modulo.CONFIG['base_url'].rstrip('/') not in ('http://localhost:8087', 'http://127.0.0.1:8087'):
        raise ValueError('Confira o motor configurado na porta 8087 antes de continuar.')
    modulo.CONFIG['base_url'] = carregar_motor(motor_id)['origem']
    return modulo


def listar_jobs(kit):
    status, corpo = kit.req('GET', '/api/v1/jobs')
    try:
        jobs = json.loads(corpo)
        if jobs is None and status == 200:
            jobs = []
        if status != 200 or not isinstance(jobs, list) or any(
            not isinstance(j, dict) or j.get('Status', j.get('status')) not in ('ok','failed','working','pending','queued') for j in jobs):
            raise ValueError()
    except (ValueError, TypeError):
        raise RuntimeError('Resposta do motor não confirmada.') from None
    return jobs


def conferir_conexao(campanha, motor_id='01'):
    modulo = carregar_coletor(campanha, motor_id)
    jobs = listar_jobs(modulo.load_kit())
    return {'ok': True, 'motor': modulo.CONFIG['base_url'], 'jobs': len(jobs),
        'ativos': sum(j.get('Status', j.get('status')) in ('working', 'pending', 'queued') for j in jobs)}


def reconciliar_intencao(pasta, pedido, motor, kit):
    intencao = json.loads((pasta/'intencao.json').read_text(encoding='utf-8'))
    request = intencao.get('request')
    if not (pasta/'pedido.json').exists() or intencao.get('pedido_id') != pedido['id'] or intencao.get('motor','01') != motor['id'] or not isinstance(request,dict) or not intencao.get('started_at'):
        raise RuntimeError('Intenção divergente. Reconcilie os arquivos antes de continuar.')
    conferir_consultas(pedido, consulta(pedido), intencao)
    def corresponde(job):
        dados=job.get('Data')
        if job.get('Name') != request.get('name') or not job.get('ID') or not isinstance(dados,dict):
            return False
        for chave,valor in request.items():
            if chave == 'name':
                continue
            if chave in ('lat','lon'):
                try:
                    esperado=Decimal(str(valor)); recebido=Decimal(str(dados.get(chave)))
                    if not esperado.is_finite() or not recebido.is_finite() or esperado != recebido:
                        return False
                except InvalidOperation:
                    return False
            elif chave == 'max_time':
                if type(valor) is not int or dados.get(chave) != valor*1000000000:
                    return False
            elif dados.get(chave) != valor:
                return False
        return True
    encontrados=[j for j in listar_jobs(kit) if corresponde(j)]
    if len(encontrados) != 1:
        raise RuntimeError('Criação incerta sem correspondência única. Preserve a intenção; nenhum novo POST foi enviado.')
    return {'id':encontrados[0]['ID'],'request':request,'started_at':intencao['started_at'],'pedido_id':pedido['id'],'motor':motor['id'], **({'consulta_versao':intencao['consulta_versao']} if 'consulta_versao' in intencao else {})}

def processar_resultados(modulo, raw, mapa, pedido, pasta):
    if pedido.get('contrato') == 2:
        return processar_neutro(raw, pedido, pasta, areas_ativas(pedido, getattr(modulo, 'CONFIG', {})))
    with raw.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        campos_brutos = reader.fieldnames or []
        vazia = next(reader, None) is None
    if not vazia:
        return modulo.process(raw, mapa, pedido['bairro'], pasta/'historico.json', pasta, 50,
            cidade=pedido['cidade'], uf=pedido['uf'], fila_planejada=True)
    campos = ['nome_empresa', 'categoria', 'telefone', 'email', 'site', 'endereco', 'bairro', 'cep', 'cidade',
        'link_maps', 'termo_pesquisado', 'data_coleta', 'cnpj', 'razao_social', 'perfil', 'motivo_aderencia',
        'situacao_empresa', 'situacao_historico', 'fonte_email', 'emails_motor_nao_reconfirmados', 'observacoes',
        'place_id', 'cid', 'data_id', 'latitude', 'longitude', 'ocorrencias_brutas']
    for nome, cabecalho in [('empresas_novas.csv', campos), ('empresas_sinalizadas.csv', campos), ('bruto_completo.csv', campos_brutos)]:
        with (pasta/nome).open('w', encoding='utf-8-sig', newline='') as stream:
            csv.DictWriter(stream, fieldnames=cabecalho, quoting=csv.QUOTE_ALL, lineterminator='\r\n').writeheader()
    dados = {'fields': campos, 'selected': [], 'all': [], 'raw_fields': campos_brutos, 'raw_rows': [],
        'output_files': {'selected': 'empresas_novas.csv', 'all': 'empresas_sinalizadas.csv', 'raw': 'bruto_completo.csv'}}
    resumo = {'registros_brutos': 0, 'empresas_unicas': 0, 'novas_selecionadas': 0, 'meta': 50,
        'verificacao': 'Coleta vazia preservada. Nenhuma pesquisa adicional foi iniciada.'}
    for nome, valor in [('dados_preparados.json', dados), ('resumo.json', resumo)]:
        temporario = pasta/(nome+'.tmp')
        temporario.write_text(json.dumps(valor, ensure_ascii=False, indent=2), encoding='utf-8')
        temporario.replace(pasta/nome)
    return resumo


def processar_neutro(raw, pedido, pasta, limitar=False):
    with raw.open(encoding='utf-8-sig', newline='') as stream:
        linhas = list(csv.DictReader(stream))
    empresas = []
    for linha in linhas:
        emails = linha.get('email') or linha.get('emails') or ''
        try:
            lista = json.loads(emails)
            if isinstance(lista, list):
                emails = ';'.join(str(v) for v in lista)
        except (ValueError, TypeError):
            pass
        email = next((v.strip().lower() for v in re.split('[;,]', str(emails)) if re.fullmatch(r'[^\s@]+@[^\s@]+', v.strip())), None)
        empresas.append({'google_place_id': linha.get('place_id') or linha.get('google_place_id') or None,
            'cnpj': linha.get('cnpj') or None, 'razao_social': linha.get('razao_social') or None,
            'nome_fantasia': linha.get('title') or linha.get('nome_empresa') or linha.get('nome_fantasia') or None,
            'contato_nome': linha.get('contato_nome') or None,
            'telefone': telefone(linha.get('phone') or linha.get('telefone')) or None, 'email': email,
            'cep': linha.get('cep') or None, 'cnae_principal': linha.get('cnae_principal') or None,
            'endereco': linha.get('address') or linha.get('endereco') or '', 'categoria': linha.get('category') or linha.get('categoria') or '',
            'site': linha.get('website') or linha.get('site') or '', 'situacao_google': linha.get('status') or '',
            'link_maps': linha.get('link') or linha.get('link_maps') or '', 'dados_brutos': linha})
    empresas = priorizar(empresas, pedido.get('criterios', {}))
    if limitar:
        distintas, vistas = [], set()
        for empresa in empresas:
            chaves = identidades(empresa)
            if not chaves or chaves.intersection(vistas):
                continue
            distintas.append(empresa)
            vistas.update(chaves)
            if len(distintas) == 150:
                break
        empresas = distintas
    campos = ['telefone', 'cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'email', 'cep', 'cnae_principal', 'google_place_id']
    for nome, selecionadas in [('empresas_novas.csv', empresas[:50]), ('empresas_sinalizadas.csv', empresas)]:
        with (pasta/nome).open('w', encoding='utf-8-sig', newline='') as stream:
            writer = csv.DictWriter(stream, fieldnames=campos, extrasaction='ignore', quoting=csv.QUOTE_ALL, lineterminator='\r\n')
            writer.writeheader()
            writer.writerows(selecionadas)
    (pasta/'bruto_completo.csv').write_bytes(raw.read_bytes())
    dados = {'fields': campos, 'all': empresas, 'selected': empresas[:50],
        'output_files': {'selected': 'empresas_novas.csv', 'all': 'empresas_sinalizadas.csv', 'raw': 'bruto_completo.csv'}}
    if not limitar:
        dados['raw_rows'] = linhas
    dados_bytes = json.dumps(dados, ensure_ascii=False, indent=2).encode('utf-8') if limitar else None
    if dados_bytes is not None and len(dados_bytes) > 9000000:
        raise RuntimeError('Intermediário excede 9.000.000 bytes. Bruto preservado; etapa pendente.')
    resumo = {'registros_brutos': len(linhas), 'candidatas_preparadas': len(empresas), 'novas_selecionadas': 0,
        'meta': 50, 'contrato': 2, 'snapshot_sha256': pedido.get('snapshot_sha256'), 'revisao': pedido.get('revisao')}
    for nome, valor in [('dados_preparados.json', dados), ('resumo.json', resumo)]:
        temporario = pasta/(nome + '.tmp')
        if limitar:
            conteudo = dados_bytes if nome == 'dados_preparados.json' else json.dumps(valor, ensure_ascii=False, indent=2).encode('utf-8')
            temporario.write_bytes(conteudo)
        else:
            temporario.write_text(json.dumps(valor, ensure_ascii=False, indent=2), encoding='utf-8')
        temporario.replace(pasta/nome)
    return resumo


def coletar(pedido, campanha, motor_id='01'):
    motor=carregar_motor(motor_id)
    if pedido.get('motor',motor_id) != motor_id:
        raise RuntimeError('Pedido pertence a outro motor.')
    if pedido.get('contrato') != 2 and motor_id != '01':
        raise RuntimeError('Pedido legado pertence somente ao motor 01.')
    pedido=dict(pedido,motor=motor_id)
    if not re.fullmatch(r'[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}', pedido.get('id', ''), re.I):
        raise ValueError('Identidade do pedido inválida.')
    if pedido.get('estado') != 'coletando':
        raise ValueError('Pedido não está em coleta. Reconcilie a etapa atual antes de continuar.')
    modulo = carregar_coletor(campanha, motor_id)
    modo_areas = areas_ativas(pedido, getattr(modulo, 'CONFIG', {}))
    email = opcao_booleana(getattr(modulo, 'CONFIG', {}), 'coletar_email', True) if pedido.get('contrato') == 2 else True
    pasta = pasta_do_pedido(modulo.HERE, pedido)
    pasta.mkdir(parents=True, exist_ok=True)
    with ExitStack() as locks:
        locks.enter_context(travar_motor(motor))
        locks.enter_context(travar_execucao(pasta.parent if pedido.get('contrato') == 2 else pasta))
        if motor_id == '01':
            locks.enter_context(modulo.campaign_lock(modulo.HISTORY))
        verificar_inicio(pasta, pedido, permitir_intencao=True)
        modulo.save_json(pasta/'pedido.json', pedido)
        modulo.save_json(pasta/'contexto-operacional.json', contexto_operacional(pedido))
        if (pasta/'dados_preparados.json').exists() and (pasta/'resumo.json').exists():
            return pasta
        kit = modulo.load_kit()
        meta = modulo.read_json(pasta/'job.json')
        termo = consulta(pedido)
        if not meta and (pasta/'intencao.json').exists():
            meta=reconciliar_intencao(pasta,pedido,motor,kit)
            modulo.save_json(pasta/'job.json',meta)
        if not meta:
            jobs = listar_jobs(kit)
            if any(str(j.get('Status', j.get('status', ''))).lower() in ('working', 'pending', 'queued') for j in jobs):
                raise RuntimeError('Há outra coleta ativa no motor. Preserve o pedido.')
            kit.UA = 'CRM-Prospeccao/1.0 (+https://github.com/Browsher/crm)'
            coords = geocodificar_com_cache(', '.join(v for v in (pedido['bairro'], pedido['cidade'], pedido['uf'], 'Brasil') if v),kit.geocode)
            if not coords:
                raise RuntimeError('Geocodificação indisponível. Preserve o pedido.')
            inicio = datetime.now(timezone.utc).isoformat()
            nome = 'crm-' + pedido['id'] + ('-coleta-' + str(pedido.get('rodada', 1)) if pedido.get('contrato') == 2 else '')
            consultas = gerar_consultas(termo, coords, modulo.CONFIG['radius'], pedido.get('rodada', 1)) if modo_areas else [termo]
            body = {'name': nome, 'keywords': consultas, 'lang': 'pt', 'zoom': 15, 'lat': str(coords[0]), 'lon': str(coords[1]),
                'fast_mode': False, 'email': email, 'radius': modulo.CONFIG['radius'], 'depth': modulo.CONFIG['depth'], 'max_time': modulo.CONFIG['max_time']}
            estrategia = {'consulta_versao': 1} if modo_areas else {}
            modulo.save_json(pasta/'intencao.json', {'pedido_id': pedido['id'], 'motor':motor_id, 'request': body, 'started_at': inicio, **estrategia})
            resposta = json.loads(kit.req('POST', '/api/v1/jobs', body)[1])
            meta = {'id': resposta['id'], 'request': body, 'started_at': inicio, 'pedido_id': pedido['id'], 'motor':motor_id, **estrategia}
            modulo.save_json(pasta/'job.json', meta)
        if meta.get('pedido_id') != pedido['id']:
            raise RuntimeError('Job divergente. Preserve a pasta para conferência.')
        conferir_consultas(pedido, termo, meta)
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
            logs = subprocess.run(['docker', 'logs', '--since', meta['started_at'], motor['container']], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60, check=True)
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
        if pedido.get('contrato') != 2:
            modulo.CONFIG['termos'] = [pedido['nicho']]
            modulo.profile = lambda row, evidence: ('Nicho solicitado', 'Aderência comercial a conferir pelo vendedor.', 0)
        processar_resultados(modulo, raw, mapa, pedido, pasta)
        return pasta


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('acao', choices=('coletar', 'preparar', 'contexto', 'conferir'))
    parser.add_argument('--pedido')
    parser.add_argument('--motor',choices=('01','02','03'),default='01')
    parser.add_argument('--campanha')
    parser.add_argument('--coletadas')
    parser.add_argument('--final', '--resultado', dest='final')
    parser.add_argument('--original')
    parser.add_argument('--recibo')
    parser.add_argument('--saida')
    parser.add_argument('--rodada', type=int, choices=(1, 2, 3), default=1)
    args = parser.parse_args()
    if args.acao == 'conferir':
        if not args.campanha:
            parser.error('conferir exige --campanha')
        print(json.dumps(conferir_conexao(args.campanha,args.motor)))
        return
    if not args.pedido:
        parser.error('--pedido é obrigatório para esta ação')
    pedido = json.loads(Path(args.pedido).read_text(encoding='utf-8-sig'))
    if pedido.get('contrato') == 2:
        pedido['rodada'] = args.rodada
    if args.acao == 'contexto':
        if not args.saida:
            parser.error('contexto exige --saida')
        saida = Path(args.saida)
        conteudo = json.dumps(contexto_operacional(pedido), ensure_ascii=False, indent=2)
        if saida.exists() and json.loads(saida.read_text(encoding='utf-8-sig')) != contexto_operacional(pedido):
            raise ValueError('Contexto operacional existente diverge. Preserve-o para reconciliação.')
        saida.write_text(conteudo, encoding='utf-8')
        print(str(saida))
        return
    if args.acao == 'coletar':
        if not args.campanha:
            parser.error('--campanha é obrigatório')
        print(coletar(pedido, args.campanha,args.motor))
        return
    if not all((args.coletadas, args.final, args.original, args.recibo, args.saida)):
        parser.error('preparar exige --coletadas, --original, --final, --recibo e --saida')
    recibo = json.loads(Path(args.recibo).read_text(encoding='utf-8-sig'))
    conferir_recibo(pedido, recibo, args.original, args.final)
    dados = json.loads(Path(args.coletadas).read_text(encoding='utf-8-sig'))
    if recibo.get('versao') == 2:
        origem = dados.get('candidatas')
        if dados.get('lote_id') != recibo.get('lote_id') or not isinstance(origem, list) or not 1 <= len(origem) <= 50:
            raise ValueError('Use o mesmo lote reservado no CRM.')
        empresas = origem
    else:
        with Path(args.final).open(encoding='utf-8-sig', newline='') as stream:
            validadas = list(csv.DictReader(stream))
        origem = dados['all']
        if len(origem) > 5000:
            raise ValueError('Lote excede a capacidade de auditoria. Preserve os arquivos e confira antes de publicar.')
        empresas = normalizar(origem, validadas)
    publicacao = {'acao': 'entregar', 'pedido': pedido['id'], 'empresas': empresas, 'recibo': recibo}
    saida = Path(args.saida)
    conteudo = json.dumps(publicacao, ensure_ascii=False, indent=2)
    if saida.exists() and saida.read_text(encoding='utf-8') != conteudo:
        raise ValueError('Arquivo de publicação existente diverge. Preserve-o para reconciliação.')
    saida.write_text(conteudo, encoding='utf-8')
    print(str(saida))


if __name__ == '__main__':
    main()
