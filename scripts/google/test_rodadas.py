import unittest
from rodadas import selecionar_lote, decidir_continuacao, identidades


class RodadasTest(unittest.TestCase):
    def test_tres_lotes_de_50_entregam_18_22_10(self):
        vistas = set()
        entregues = 0
        for rodada, aprovadas in enumerate([18, 22, 10], 1):
            pool = [{'google_place_id': str(i), 'endereco': 'Recebido sem alteração'} for i in range(150)]
            lote = selecionar_lote(pool, vistas, 150 - len(vistas))
            self.assertEqual(len(lote), 50)
            for empresa in lote:
                vistas.update(identidades(empresa))
            entregues += aprovadas
            self.assertEqual(decidir_continuacao(entregues, rodada * 50, rodada, 50), 'meta_atingida' if rodada == 3 else 'continuar')
        self.assertEqual(len(vistas), 150)

    def test_terceira_rodada_sem_aprovadas_nao_abre_quarta(self):
        self.assertEqual(decidir_continuacao(12, 150, 3, 50), 'limite_lotes')

    def test_sem_novidades_encerra_antes_do_limite(self):
        self.assertEqual(decidir_continuacao(3, 50, 1, 0), 'sem_novidades')
        self.assertEqual(decidir_continuacao(0, 0, 0, 0), 'sem_resultados')

    def test_alias_cnpj_repetido_nao_consume_candidata_e_nao_altera_dado(self):
        a = {'google_place_id': 'a', 'cnpj': '11222333000181', 'telefone': None, 'endereco': 'Outra região'}
        b = {**a, 'google_place_id': 'b'}
        self.assertEqual(selecionar_lote([a, b], set(), 150), [a])
        self.assertEqual(selecionar_lote([a], identidades(b), 150), [])
        self.assertIsNone(a['telefone'])

    def test_respeita_orcamento_restante_e_identidade_confiavel(self):
        pool = [{'nome_fantasia': 'Sem identificador'}] + [{'google_place_id': str(i)} for i in range(20)]
        self.assertEqual(len(selecionar_lote(pool, set(), 1)), 1)
        self.assertEqual(selecionar_lote(pool, set(), 0), [])
