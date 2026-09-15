import { expect, test } from 'vitest'
import { ETAPAS_FUNIL, ehEtapaFunil, proximaEtapa } from './comercial'

test('funil aceita somente as três etapas abertas', () => {
  expect(ETAPAS_FUNIL).toEqual(['primeiro_contato', 'em_negociacao', 'proposta_enviada'])
  for (const etapa of ETAPAS_FUNIL) expect(ehEtapaFunil(etapa)).toBe(true)
  for (const etapa of ['venda_concluida', 'toString', '', 'Primeiro contato']) expect(ehEtapaFunil(etapa)).toBe(false)
})

test('próxima etapa segue sequência fechada e termina na proposta',()=>{
  expect(proximaEtapa('primeiro_contato')).toBe('em_negociacao')
  expect(proximaEtapa('em_negociacao')).toBe('proposta_enviada')
  expect(proximaEtapa('proposta_enviada')).toBeNull()
  expect(proximaEtapa('adulterada')).toBeNull()
})
