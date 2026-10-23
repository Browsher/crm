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

if __name__ == '__main__':
    unittest.main()
