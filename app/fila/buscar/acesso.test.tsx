import { expect, test, vi } from 'vitest'
const { exigir } = vi.hoisted(() => ({ exigir: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))
import { buscarEmpresasAcao, importarBuscaAcao } from './acoes'
import { salvarLimiteAcao } from '../../empresas/busca/acoes'

test.each([
  ['consulta', 'vendedor', () => buscarEmpresasAcao({ erro: null }, new FormData())],
  ['importação', 'vendedor', () => importarBuscaAcao({ erro: null, grupoId: null, inseridas: 0, vinculadas: 0 }, new FormData())],
  ['limites', 'gestor', () => salvarLimiteAcao({ erro: null, salvo: false }, new FormData())],
] as const)('%s exige o papel correto antes de processar entradas', async (_nome, papel, executar) => {
  exigir.mockClear()
  const bloqueio = new Error('acesso negado')
  exigir.mockRejectedValueOnce(bloqueio)
  await expect(executar()).rejects.toBe(bloqueio)
  expect(exigir).toHaveBeenCalledWith(papel)
})
