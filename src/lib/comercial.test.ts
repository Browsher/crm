import { expect, test } from 'vitest'
import { ETAPAS_FUNIL, ehEtapaFunil } from './comercial'

test('funil aceita somente as três etapas abertas', () => {
  expect(ETAPAS_FUNIL).toEqual(['primeiro_contato', 'em_negociacao', 'proposta_enviada'])
  for (const etapa of ETAPAS_FUNIL) expect(ehEtapaFunil(etapa)).toBe(true)
  for (const etapa of ['venda_concluida', 'toString', '', 'Primeiro contato']) expect(ehEtapaFunil(etapa)).toBe(false)
})
