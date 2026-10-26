import { expect, test, vi } from 'vitest'
import { POST } from './route'
const leituras=vi.hoisted(()=>({sync:vi.fn(async()=>({estado:'sincronizado'})),revalidar:vi.fn()}))
vi.mock('next/cache', () => ({ revalidatePath: leituras.revalidar }))
vi.mock('@/src/server/google/autenticacao', () => ({ autorizarAgente: () => ({ ok: true, usuarioId: 'gestor' }) }))
vi.mock('@/src/server/google/planilha/sincronizar', () => ({ sincronizarPedido: leituras.sync }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: () => ({
  consultar: async (pedido: string, executor: string) => ({pedido_id:pedido,executor_id:executor,analisadas:10,entregues:3}),
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

test('API consulta progresso sem sincronizar planilha ou revalidar pagina',async()=>{
  leituras.sync.mockClear();leituras.revalidar.mockClear()
  const r=await POST(req({acao:'consultar'}))
  expect(r.status).toBe(200)
  expect(await r.json()).toEqual({execucao:{pedido_id:pedido,executor_id:executor,analisadas:10,entregues:3}})
  expect(leituras.sync).not.toHaveBeenCalled()
  expect(leituras.revalidar).not.toHaveBeenCalled()
  expect((await POST(req({acao:'consultar',vendedor:'escolhido'}))).status).toBe(400)
})