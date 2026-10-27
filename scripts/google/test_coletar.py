import importlib.util
import json
import tempfile
import unittest
import subprocess
import sys
import types
import csv
from contextlib import nullcontext
from unittest.mock import patch
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('ponte', Path(__file__).with_name('coletar.py'))
ponte = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ponte)

PEDIDO = {'id': '00000000-0000-4000-8000-000000000001', 'nicho': 'Pet shop $()', 'bairro': 'Brás', 'cidade': 'São Paulo', 'uf': 'SP', 'estado': 'coletando'}

class PonteTest(unittest.TestCase):
    def coletar_fixture(self, cfg=None, bairro='', rodada=1, coords=(-23.55,-46.63), perder_resposta=False):
        temp=tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        raiz=Path(temp.name)
        pedido=dict(PEDIDO,contrato=2,vendedor_id='00000000-0000-4000-8000-000000000002',execucao_id='00000000-0000-4000-8000-000000000003',bairro=bairro,rodada=rodada)
        corpos=[]
        def req(metodo,rota,body=None):
            if metodo=='POST':
                corpos.append(body)
                if perder_resposta and len(corpos)==1:raise ConnectionError('Resposta perdida depois da criação')
                return 201,b'{"id":"job-fixture"}'
            if rota=='/api/v1/jobs':
                jobs=[] if not corpos else [{'ID':'job-fixture','Name':corpos[0]['name'],'Status':'ok','Data':dict(corpos[0],lat=float(corpos[0]['lat']),lon=float(corpos[0]['lon']),max_time=corpos[0]['max_time']*1000000000)}]
                return 200,json.dumps(jobs).encode()
            if rota.endswith('/download'):return 200,b'place_id,title,phone\nA,Loja,1133334444\n'
            return 200,b'{"Status":"ok"}'
        modulo=types.SimpleNamespace(HERE=raiz,HISTORY=raiz/'historico.json',CONFIG=dict(radius=20000,depth=5,max_time=900,**(cfg or {})),
            campaign_lock=lambda _:nullcontext(),load_kit=lambda:types.SimpleNamespace(req=req,geocode=lambda _:coords),
            save_json=lambda p,v:p.write_text(json.dumps(v),encoding='utf-8'),read_json=lambda p:json.loads(p.read_text(encoding='utf-8')) if p.exists() else None)
        with patch.object(ponte,'carregar_coletor',return_value=modulo),patch.object(ponte,'travar_motor',return_value=nullcontext()),patch.object(ponte,'travar_execucao',return_value=nullcontext()),patch.object(ponte,'geocodificar_com_cache',return_value=coords),patch.object(ponte.subprocess,'run',return_value=types.SimpleNamespace(stdout='',stderr='')):
            if perder_resposta:
                with self.assertRaises(ConnectionError):ponte.coletar(pedido,raiz)
            pasta=ponte.coletar(pedido,raiz)
        self.ultima_quantidade_posts=len(corpos)
        return corpos[0],pasta,pedido

    def test_optin_busca_quatro_areas_com_mesmo_termo_literal(self):
        from urllib.parse import urlparse,unquote
        body,pasta,pedido=self.coletar_fixture({'coleta_por_areas':True})
        self.assertEqual(len(body['keywords']),4)
        self.assertEqual(len(set(body['keywords'])),4)
        for u in body['keywords']:
            self.assertEqual(urlparse(u).hostname,'www.google.com')
            self.assertIn(ponte.consulta(pedido),unquote(urlparse(u).path))
        self.assertEqual(json.loads((pasta/'job.json').read_text(encoding='utf-8'))['consulta_versao'],1)

    def test_resposta_post_perdida_reconcilia_grade_sem_criar_outro_job(self):
        _,pasta,_=self.coletar_fixture({'coleta_por_areas':True},perder_resposta=True)
        self.assertEqual(self.ultima_quantidade_posts,1)
        self.assertEqual(json.loads((pasta/'job.json').read_text(encoding='utf-8'))['id'],'job-fixture')
        self.assertEqual(json.loads((pasta/'job.json').read_text(encoding='utf-8'))['consulta_versao'],1)

    def test_reconciliacao_da_grade_reusa_mesmo_job_e_versao(self):
        body,pasta,pedido=self.coletar_fixture({'coleta_por_areas':True})
        data=dict(body,max_time=body['max_time']*1000000000,lat=float(body['lat']),lon=float(body['lon']))
        chamadas=[]
        def req(metodo,rota):
            chamadas.append((metodo,rota));return 200,json.dumps([{'ID':'job-fixture','Name':body['name'],'Status':'ok','Data':data}]).encode()
        try:meta=ponte.reconciliar_intencao(pasta,pedido,{'id':'01'},types.SimpleNamespace(req=req))
        except RuntimeError:meta=None
        self.assertIsNotNone(meta,'Uma grade salva válida deve reconciliar sem outro POST')
        self.assertEqual(meta['consulta_versao'],1)
        self.assertEqual(meta['id'],'job-fixture')
        self.assertEqual(chamadas,[('GET','/api/v1/jobs')])
        intencao=json.loads((pasta/'intencao.json').read_text(encoding='utf-8'))
        intencao['request']['keywords'][0]='https://example.com/fora-do-pedido'
        (pasta/'intencao.json').write_text(json.dumps(intencao),encoding='utf-8')
        chamadas.clear()
        with self.assertRaises(RuntimeError):ponte.reconciliar_intencao(pasta,pedido,{'id':'01'},types.SimpleNamespace(req=req))
        self.assertEqual(chamadas,[])

    def test_rodadas_usam_areas_diferentes_sem_alterar_pedido(self):
        consultas=[]
        for rodada in (1,2,3):
            b,_,_=self.coletar_fixture({'coleta_por_areas':True},rodada=rodada)
            consultas.extend(b['keywords'])
        self.assertEqual(len(set(consultas)),12)

    def test_bairro_e_modo_antigo_preservam_consulta_unica(self):
        for cfg,bairro in [({},''),({'coleta_por_areas':True},'Brás')]:
            body,_,pedido=self.coletar_fixture(cfg,bairro=bairro)
            self.assertEqual(body['keywords'],[ponte.consulta(pedido)])
            self.assertTrue(body['email'])

    def test_email_opcional_so_quando_configurado_no_ensaio(self):
        body,_,_=self.coletar_fixture({'coleta_por_areas':True,'coletar_email':False})
        self.assertFalse(body['email'])

    def test_coordenada_nao_finita_e_flag_invalida_nao_criam_post(self):
        for cfg,coords in [({'coleta_por_areas':True},(float('nan'),-46.6)),({'coleta_por_areas':'sim'},(-23.5,-46.6)),({'coletar_email':'nao'},(-23.5,-46.6))]:
            with self.assertRaises(ValueError):
                self.coletar_fixture(cfg,coords=coords)

    def test_recorte_do_modo_areas_preserva_csv_e_candidatas_distintas(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz=Path(temp);raw=raiz/'bruto_original_full.csv'
            linhas=['place_id,title,phone']+[f'A{i},Loja {i},1133334444' for i in range(170)]+['A0,Repetida,1133334444']
            raw.write_text('\n'.join(linhas)+'\n',encoding='utf-8');antes=raw.read_bytes()
            pedido=dict(PEDIDO,contrato=2,bairro='')
            modulo=types.SimpleNamespace(CONFIG={'coleta_por_areas':True})
            ponte.processar_resultados(modulo,raw,{},pedido,raiz)
            dados=json.loads((raiz/'dados_preparados.json').read_text(encoding='utf-8'))
            self.assertEqual(len(dados['all']),150)
            self.assertEqual(len({e['google_place_id'] for e in dados['all']}),150)
            self.assertNotIn('raw_rows',dados)
            self.assertEqual(raw.read_bytes(),antes)
            self.assertEqual((raiz/'bruto_completo.csv').read_bytes(),antes)

    def test_limite_utf8_confere_os_mesmos_bytes_gravados_no_windows(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz=Path(temp);base=raiz/'base';base.mkdir();destino=raiz/'final';destino.mkdir()
            modulo=types.SimpleNamespace(CONFIG={'coleta_por_areas':True});pedido=dict(PEDIDO,contrato=2,bairro='')
            def gravar(pasta,preenchimento):
                raw=pasta/'bruto_original_full.csv'
                raw.write_text('place_id,title,phone,descriptions\n'+''.join(f'A{i},Loja,1133334444,'+'x'*preenchimento+'\n' for i in range(40)),encoding='utf-8')
                return raw
            ponte.processar_resultados(modulo,gravar(base,0),{},pedido,base)
            dados=json.loads((base/'dados_preparados.json').read_text(encoding='utf-8'))
            tamanho_base=len(json.dumps(dados,ensure_ascii=False,indent=2).encode('utf-8'))
            preenchimento=(9000000-1000-tamanho_base)//80
            raw=gravar(destino,preenchimento)
            try:ponte.processar_resultados(modulo,raw,{},pedido,destino)
            except RuntimeError:
                self.assertFalse((destino/'dados_preparados.json').exists())
            else:self.assertLessEqual((destino/'dados_preparados.json').stat().st_size,9000000)
            self.assertTrue(raw.exists())

    def test_intermediario_extenso_fica_pendente_com_bruto_preservado(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz=Path(temp);raw=raiz/'bruto_original_full.csv'
            raw.write_text('place_id,title,phone,descriptions\n'+''.join(f'A{i},Loja,1133334444,'+'x'*120000+'\n' for i in range(40)),encoding='utf-8')
            before=raw.read_bytes()
            with self.assertRaisesRegex(RuntimeError,'bytes'):
                ponte.processar_resultados(types.SimpleNamespace(CONFIG={'coleta_por_areas':True}),raw,{},dict(PEDIDO,contrato=2,bairro=''),raiz)
            self.assertEqual(raw.read_bytes(),before)
            self.assertFalse((raiz/'dados_preparados.json').exists())

    def test_conferencia_le_somente_jobs_sem_criar_coleta(self):
        chamadas = []
        def req(metodo, rota):
            chamadas.append((metodo, rota))
            return 200, json.dumps([{'Status':'ok'}, {'Status':'working'}]).encode()
        kit = types.SimpleNamespace(req=req)
        modulo = types.SimpleNamespace(CONFIG={'base_url':'http://127.0.0.1:8087'}, load_kit=lambda:kit)
        with patch.object(ponte, 'carregar_coletor', return_value=modulo):
            resultado = ponte.conferir_conexao('campanha-movida')
        self.assertEqual(chamadas, [('GET','/api/v1/jobs')])
        self.assertEqual(resultado, {'ok':True,'motor':'http://127.0.0.1:8087','jobs':2,'ativos':1})

    def test_conferencia_recusa_resposta_de_saude_ilegivel(self):
        for retorno in [(503,b'[]'),(200,b'{}'),(200,b'[{}]')]:
            kit = types.SimpleNamespace(req=lambda *a:retorno)
            modulo = types.SimpleNamespace(CONFIG={'base_url':'http://127.0.0.1:8087'}, load_kit=lambda:kit)
            with patch.object(ponte, 'carregar_coletor', return_value=modulo):
                with self.assertRaisesRegex(RuntimeError, 'Resposta'):
                    ponte.conferir_conexao('campanha')

    def test_recibo_v2_nao_exige_whatsapp_e_confere_snapshot_e_arquivos(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            original = raiz/'original.csv'
            resultado = raiz/'resultado.json'
            original.write_text('origem', encoding='utf-8')
            resultado.write_text('[]', encoding='utf-8')
            pedido = dict(PEDIDO, contrato=2, execucao_id='00000000-0000-4000-8000-000000000003', revisao=1, snapshot_sha256='c'*64)
            recibo = dict(versao=2, pedido_id=pedido['id'], execucao_id=pedido['execucao_id'], lote_id='00000000-0000-4000-8000-000000000004', revisao=1, snapshot_sha256='c'*64,
                origem_sha256=ponte.sha256(original), resultado_sha256=ponte.sha256(resultado), arquivo_original_id='original', arquivo_resultado_id='resultado', verificacoes_requeridas=[], evidencias=[])
            ponte.conferir_recibo(pedido, recibo, original, resultado)
            with self.assertRaisesRegex(ValueError, 'snapshot'):
                ponte.conferir_recibo(pedido, dict(recibo, revisao=2), original, resultado)

    def test_v2_processa_google_neutro_sem_classificador_da_campanha(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            raw = raiz/'bruto_original_full.csv'
            raw.write_text('place_id,title,phone,address,website,status,emails,review_rating,review_count\nA,Loja sem telefone,,Endereço real,,permanently_closed,[],4.5,10\n', encoding='utf-8')
            modulo = types.SimpleNamespace(process=lambda *a, **k: self.fail('Classificador legado não deve rodar'))
            ponte.processar_resultados(modulo, raw, {}, dict(PEDIDO, contrato=2), raiz)
            dados = json.loads((raiz/'dados_preparados.json').read_text(encoding='utf-8'))
            self.assertEqual(len(dados['all']), 1)
            self.assertEqual(dados['all'][0]['google_place_id'], 'A')
            self.assertIsNone(dados['all'][0]['telefone'])
            self.assertEqual(dados['all'][0]['endereco'], 'Endereço real')
            self.assertNotIn('validado', dados['all'][0])
            self.assertEqual((raiz/'bruto_completo.csv').read_bytes(), raw.read_bytes())

    def test_v2_isola_coletas_e_congela_criterios_adicionais(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            pedido = dict(PEDIDO, contrato=2, vendedor_id='00000000-0000-4000-8000-000000000002', execucao_id='00000000-0000-4000-8000-000000000003', criterios={'termos':'perto do centro'}, rodada=1)
            primeira = ponte.pasta_do_pedido(raiz, pedido)
            segunda = ponte.pasta_do_pedido(raiz, dict(pedido, rodada=2))
            self.assertNotEqual(primeira, segunda)
            self.assertIn('perto do centro', ponte.consulta(pedido))
            primeira.mkdir(parents=True)
            (primeira/'pedido.json').write_text(json.dumps(pedido), encoding='utf-8')
            with self.assertRaisesRegex(RuntimeError, 'divergentes'):
                ponte.verificar_inicio(primeira, dict(pedido, criterios={'termos':'outro termo'}))

    def test_retoma_pasta_legada_com_metadados_novos_sem_criar_job(self):
        with tempfile.TemporaryDirectory() as temp:
            raiz = Path(temp)
            antigo = dict(PEDIDO, vendedor_id='00000000-0000-4000-8000-000000000002', dia='2026-10-22')
            novo = dict(antigo, revisao=1, executor='00000000-0000-4000-8000-000000000003')
            pasta = raiz/'coletas'/'crm'/antigo['id']
            pasta.mkdir(parents=True)
            for nome, valor in [('pedido.json', antigo), ('job.json', {'id':'job-anterior'}), ('dados_preparados.json', {'all':[]}), ('resumo.json', {'total':0})]:
                (pasta/nome).write_text(json.dumps(valor), encoding='utf-8')
            job_anterior = (pasta/'job.json').read_bytes()
            modulo = types.SimpleNamespace(HERE=raiz, HISTORY=raiz/'historico.json', campaign_lock=lambda _:nullcontext(),
                save_json=lambda caminho, valor:caminho.write_text(json.dumps(valor), encoding='utf-8'))
            with patch.object(ponte, 'carregar_coletor', return_value=modulo):
                self.assertEqual(ponte.coletar(novo, raiz), pasta)
            self.assertEqual((pasta/'job.json').read_bytes(), job_anterior)
            for divergente in [dict(novo, vendedor_id='00000000-0000-4000-8000-000000000004'), dict(novo, nicho='Outro nicho')]:
                with self.assertRaisesRegex(RuntimeError, 'divergentes'):
                    ponte.verificar_inicio(pasta, divergente)

    def test_pasta_do_agente_isola_vendedor_e_preserva_execucao_legada(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            pedido = dict(PEDIDO, vendedor_id='00000000-0000-4000-8000-000000000002')
            nova = ponte.pasta_do_pedido(raiz, pedido)
            self.assertEqual(nova, raiz/'coletas'/'agentes'/pedido['vendedor_id']/pedido['id'])
            antiga = raiz/'coletas'/'crm'/pedido['id']
            antiga.mkdir(parents=True)
            self.assertEqual(ponte.pasta_do_pedido(raiz, pedido), antiga)
            with self.assertRaises(ValueError):
                ponte.pasta_do_pedido(raiz, dict(pedido, vendedor_id='../../outro'))

    def test_contexto_operacional_cidade_inteira_preserva_criterios_e_enderecos(self):
        pedido = dict(PEDIDO, bairro='')
        contexto = ponte.contexto_operacional(pedido)
        self.assertEqual(contexto['bairro'], 'Cidade inteira')
        self.assertEqual(contexto['criterios']['bairro'], '')
        self.assertEqual(contexto['pedido_id'], pedido['id'])
        self.assertEqual(ponte.contexto_operacional(PEDIDO)['bairro'], 'Brás')
        self.assertEqual(pedido['bairro'], '')
        self.assertNotIn('Cidade inteira', ponte.consulta(pedido))

    def test_criterios_sao_uma_consulta_literal_sem_filtro_de_armarinhos(self):
        self.assertEqual(ponte.consulta(PEDIDO), 'Pet shop $() Brás São Paulo SP')
        self.assertEqual(ponte.consulta(dict(PEDIDO, bairro='')), 'Pet shop $() São Paulo SP')

    def test_validacao_de_outro_place_nao_libera_empresa(self):
        origem = [{'place_id': 'A', 'nome_empresa': 'Loja', 'telefone': '(11) 98888-7777'}]
        validada = [{'google_place_id': 'B', 'telefone': '11988887777'}]
        self.assertFalse(ponte.normalizar(origem, validada)[0]['validado'])

    def test_normaliza_sem_inventar_ddd_ou_alterar_endereco(self):
        origem = [{'place_id': 'A', 'nome_empresa': 'Loja', 'telefone': '988887777', 'endereco': 'Endereço de outra região'}]
        linha = ponte.normalizar(origem, [{'google_place_id': 'A', 'telefone': '988887777'}])[0]
        self.assertEqual(linha['telefone'], '')
        self.assertEqual(linha['endereco'], 'Endereço de outra região')
        self.assertFalse(linha['validado'])

    def test_telefone_validado_identidade_e_fechamento_sao_preservados(self):
        origem = [{'place_id': 'A', 'nome_empresa': 'Loja', 'telefone': '+55 (11) 98888-7777', 'situacao_empresa': 'Fechamento sinalizado no Maps'}]
        linha = ponte.normalizar(origem, [{'google_place_id': 'A', 'telefone': '11988887777'}])[0]
        self.assertTrue(linha['validado'])
        self.assertTrue(linha['fechada'])
        self.assertEqual(linha['google_place_id'], 'A')

    def test_recibo_divergente_nao_gera_publicacao(self):
        with tempfile.TemporaryDirectory() as pasta:
            original = Path(pasta)/'original.csv'
            final = Path(pasta)/'final.csv'
            original.write_text('origem', encoding='utf-8')
            final.write_text('final', encoding='utf-8')
            recibo = {'pedido_id': PEDIDO['id'], 'validacao_conferida': True, 'origem_sha256': 'errado', 'final_sha256': ponte.sha256(final),
                'arquivo_original_id': 'original', 'arquivo_final_id': 'final'}
            with self.assertRaisesRegex(ValueError, 'hash'):
                ponte.conferir_recibo(PEDIDO, recibo, original, final)

    def test_intencao_incerta_nao_cria_outro_job(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            (raiz/'intencao.json').write_text(json.dumps({'pedido_id': PEDIDO['id']}), encoding='utf-8')
            with self.assertRaisesRegex(RuntimeError, 'Reconcilie'):
                ponte.verificar_inicio(raiz, PEDIDO)

    def test_preparacao_preserva_mais_de_50_ocorrencias_para_auditoria(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            (raiz/'pedido.json').write_text(json.dumps(PEDIDO), encoding='utf-8')
            (raiz/'origem.csv').write_text('origem', encoding='utf-8')
            (raiz/'final.csv').write_text('google_place_id,telefone\n', encoding='utf-8')
            (raiz/'coletadas.json').write_text(json.dumps({'all': [{'place_id': 'A'+str(i), 'nome_empresa': 'Loja'} for i in range(51)]}), encoding='utf-8')
            recibo = {'pedido_id': PEDIDO['id'], 'validacao_conferida': True, 'origem_sha256': ponte.sha256(raiz/'origem.csv'),
                'final_sha256': ponte.sha256(raiz/'final.csv'), 'arquivo_original_id': 'original', 'arquivo_final_id': 'final'}
            (raiz/'recibo.json').write_text(json.dumps(recibo), encoding='utf-8')
            args = [sys.executable, str(Path(__file__).with_name('coletar.py')), 'preparar']
            for flag, nome in [('pedido','pedido.json'), ('original','origem.csv'), ('final','final.csv'), ('coletadas','coletadas.json'), ('recibo','recibo.json'), ('saida','publicacao.json')]:
                args.extend(['--'+flag, str(raiz/nome)])
            resposta = subprocess.run(args, capture_output=True, text=True)
            self.assertEqual(resposta.returncode, 0, resposta.stderr)
            self.assertEqual(len(json.loads((raiz/'publicacao.json').read_text(encoding='utf-8'))['empresas']), 51)

    def test_coleta_vazia_gera_arquivos_conferiveis_sem_repetir_pesquisa(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = Path(pasta)
            raw = raiz/'bruto_original_full.csv'
            raw.write_text('place_id,title,phone\r\n', encoding='utf-8')
            ponte.processar_resultados(types.SimpleNamespace(), raw, {}, PEDIDO, raiz)
            dados = json.loads((raiz/'dados_preparados.json').read_text(encoding='utf-8'))
            self.assertEqual(dados['all'], [])
            with (raiz/'empresas_novas.csv').open(encoding='utf-8-sig', newline='') as stream:
                reader = csv.DictReader(stream)
                self.assertIn('place_id', reader.fieldnames)
                self.assertEqual(list(reader), [])

    def test_conferencia_aceita_null_somente_como_lista_vazia(self):
        kit=types.SimpleNamespace(req=lambda *a:(200,b'null'))
        modulo=types.SimpleNamespace(CONFIG={'base_url':'http://127.0.0.1:8088'},load_kit=lambda:kit)
        with patch.object(ponte,'carregar_coletor',return_value=modulo):
            self.assertEqual(ponte.conferir_conexao('fixture','02')['jobs'],0)

    def test_motor_immutavel_e_arquivos_antigos_sao_so_motor_01(self):
        with tempfile.TemporaryDirectory() as temp:
            pasta=Path(temp)
            (pasta/'pedido.json').write_text(json.dumps(PEDIDO),encoding='utf-8')
            ponte.verificar_inicio(pasta,dict(PEDIDO,motor='01'))
            with self.assertRaisesRegex(RuntimeError,'motor'):
                ponte.verificar_inicio(pasta,dict(PEDIDO,motor='02'))
            (pasta/'pedido.json').write_text(json.dumps(dict(PEDIDO,motor='02')),encoding='utf-8')
            ponte.verificar_inicio(pasta,dict(PEDIDO,motor='02'))

    def test_reconcilia_job_incerto_pelo_nome_e_pelos_criterios_sem_post(self):
        with tempfile.TemporaryDirectory() as temp:
            pasta=Path(temp)
            pedido=dict(PEDIDO,motor='02')
            request={'name':'crm-fixture','keywords':[ponte.consulta(pedido)],'lat':'-23.5','lon':'-46.6','lang':'pt','zoom':15,'radius':2500,'depth':1,'max_time':900,'email':True,'fast_mode':False}
            (pasta/'intencao.json').write_text(json.dumps({'pedido_id':pedido['id'],'motor':'02','request':request,'started_at':'2026-10-26T20:00:00Z'}),encoding='utf-8')
            (pasta/'pedido.json').write_text(json.dumps(pedido),encoding='utf-8')
            job={'ID':'job-confirmado','Name':'crm-fixture','Status':'working','Data':dict(request,max_time=900000000000,lat=-23.5,lon=-46.6)}
            chamadas=[]
            def req(metodo,rota):
                chamadas.append((metodo,rota))
                return 200,json.dumps([job]).encode()
            meta=ponte.reconciliar_intencao(pasta,pedido,{'id':'02'},types.SimpleNamespace(req=req))
            self.assertEqual(meta['id'],'job-confirmado')
            self.assertEqual(meta['motor'],'02')
            self.assertEqual(chamadas,[('GET','/api/v1/jobs')])
            job['Data']['keywords']=['outro nicho']
            with self.assertRaises(RuntimeError):
                ponte.reconciliar_intencao(pasta,pedido,{'id':'02'},types.SimpleNamespace(req=req))
            self.assertTrue(all(m=='GET' for m,r in chamadas))

if __name__ == '__main__':
    unittest.main()
