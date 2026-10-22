import importlib.util
import json
import tempfile
import unittest
import subprocess
import sys
import types
import csv
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('ponte', Path(__file__).with_name('coletar.py'))
ponte = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ponte)

PEDIDO = {'id': '00000000-0000-4000-8000-000000000001', 'nicho': 'Pet shop $()', 'bairro': 'Brás', 'cidade': 'São Paulo', 'uf': 'SP', 'estado': 'coletando'}

class PonteTest(unittest.TestCase):
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
