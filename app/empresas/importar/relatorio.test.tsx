import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { RelatorioImportacao } from './relatorio'

test('relatório explica identificação por origem e complemento seguro antes de confirmar', () => {
  const html = renderToStaticMarkup(<RelatorioImportacao relatorio={{ novas: 1, jaCadastradas: 1, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null }} />)
  expect(html).toContain('CNPJ ou Google Place ID')
  expect(html).toContain('somente CNPJ e razão social em branco')
  expect(html).toContain('Nada foi gravado')
})
test('recusa de identidade exige revisão e não oferece fusão automática', () => {
  const html = renderToStaticMarkup(<RelatorioImportacao relatorio={{ novas: 0, jaCadastradas: 0, recusadas: [{ tipo: 'identidade', linha: 3, motivo: 'identificadores_divergentes' }], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null }} />)
  expect(html).toContain('apontam para empresas diferentes')
  expect(html).toContain('Revise os identificadores')
})
