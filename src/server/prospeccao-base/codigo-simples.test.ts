import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'
import { compilarBibliotecaSimples } from './codigo-simples'

test.each([false, true])('bundle autocontido executa os contratos com runner seguro=%s', seguro => {
  const lib = runInNewContext((seguro ? 'Object.defineProperty = function(o){return o};' : '') + compilarBibliotecaSimples())
  const leitura = lib.lerColetaSheets([['telefone', 'nome_empresa', 'place_id'], ['1126061244', 'Loja', 'p1']])
  expect(leitura.ok).toBe(true)
  const consultas = lib.classificarConsultaComunidade(leitura.coleta.numeros,
    { success: true, data: [{ number: '551126061244', exists: true }] }, true, '2026-10-15')
  const r = lib.montarSaidas(leitura.coleta, consultas)
  expect(r.saidas.exportacao).toEqual([['', '', 'Loja', '', '1126061244', '', '', '', 'p1']])
  const plano = lib.prepararPublicacao({ validacao: 2, exportacao: 3 }, r.saidas,
    { id: 'teste', data: '2026-10-15' }, { validacao: { linhas: 50, colunas: 2 }, exportacao: { linhas: 50, colunas: 9 } })
  expect(lib.conferirSaidas(plano.esperado, {
    validacao: [['Válidos', 'Inválidos'], ['551126061244']],
    exportacao: [['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id'],
      ['', '', 'Loja', '', '1126061244', '', '', '', 'p1']],
  })).toEqual({ ok: true })
  expect(lib.rangeA1('Saída', 20, 40)).toBe("'Saída'!A1:AN20")
})