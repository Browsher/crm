import { expect, test, vi } from 'vitest'
const { exigir } = vi.hoisted(() => ({ exigir: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))
import { registrarContatoAcao } from '@/src/features/contato/acao'
import { agirNaFilaAcao } from './fila/acoes'
import { registrarVisitaAcao } from './fila/localizar/registrar-visita-acao'
import { historicoDaAgendaAcao } from './meu-dia/historico-acao'

test('registrar contato exige vendedor antes de processar formulário', async () => {
  const bloqueio = new Error('gestor deve voltar para gestão')
  exigir.mockRejectedValueOnce(bloqueio)
  await expect(registrarContatoAcao({ erro: null, ok: false }, new FormData())).rejects.toBe(bloqueio)
  expect(exigir).toHaveBeenCalledWith('vendedor')
})

test.each([
  ['reserva', () => agirNaFilaAcao({ erro: null, filaVazia: false }, new FormData())],
  ['visita', () => registrarVisitaAcao('invalido')],
  ['histórico', () => historicoDaAgendaAcao('invalido')],
] as const)('%s exige vendedor antes de processar dados', async (_nome, executar) => {
  exigir.mockClear()
  const bloqueio = new Error('gestor deve voltar para gestão')
  exigir.mockRejectedValueOnce(bloqueio)
  await expect(executar()).rejects.toBe(bloqueio)
  expect(exigir).toHaveBeenCalledWith('vendedor')
})
