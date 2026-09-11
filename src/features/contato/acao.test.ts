import { expect, test, vi } from 'vitest'
const revalidar = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('../../server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('./repositorio', () => ({ registrarContato: async () => ({ ok: true }) }))
import { registrarContatoAcao } from './acao'
test('contato bem sucedido atualiza lista de empresas recentes', async () => {
  const form = new FormData()
  form.set('id', 'empresa')
  form.set('tipo', 'nao_atendeu')
  form.set('desfecho', 'nenhum')
  const r = await registrarContatoAcao({ erro: null, ok: false }, form)
  expect(r.ok).toBe(true)
  expect(revalidar).toHaveBeenCalledWith('/fila/localizar')
})
