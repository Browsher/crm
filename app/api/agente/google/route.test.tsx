import { expect, test, vi } from 'vitest'
import { POST } from './route'
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/src/server/google/autenticacao', () => ({ autorizarAgente: () => ({ ok: true, usuarioId: 'gestor' }) }))
vi.mock('@/src/server/google/planilha/sincronizar', () => ({ sincronizarPedido: async () => ({ estado: 'sincronizado' }) }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: () => ({
  reservarLote: async (_p: string, _e: string, lote: { lote_id: string }) => ({ id: lote.lote_id, ordinal: 1 }),
  concluir: async () => ({ motivo_parada: 'sem_novidades', entregues: 0 }),
}) }))
const executor = '00000000-0000-4000-8000-000000000099'
const pedido = '00000000-0000-4000-8000-000000000001'
const req = (v: object) => new Request('http://localhost/api/agente/google', { method: 'POST', body: JSON.stringify({ pedido, executor, ...v }) })
test('API devolve reserva durável do lote', async () => {
  const r = await POST(req({ acao: 'reservar_lote', lote: { lote_id: executor, candidatas: [{ google_place_id: 'place' }] } }))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({ lote: { id: executor, ordinal: 1 } })
})
test('API confirma encerramento explícito da execução', async () => {
  const r = await POST(req({ acao: 'concluir', motivo: 'sem_novidades' }))
  expect(r.status).toBe(200)
  expect(await r.json()).toMatchObject({ resultado: { motivo_parada: 'sem_novidades' } })
})
