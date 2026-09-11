import { expect, test, vi } from 'vitest'

const UUID_VALIDO = '11111111-1111-1111-1111-111111111111'

const guarda = vi.hoisted(() => ({ exigir: vi.fn(async () => ({ usuarioId: 'eu' })) }))
const ler = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, contatos: [] })))
vi.mock('@/src/server/autenticacao/guarda', () => guarda)
vi.mock('./historico', () => ({ historicoDaAgenda: ler }))
import { historicoDaAgendaAcao } from './historico-acao'

test('sem sessão a action não lê nada: a guarda interrompe antes', async () => {
  guarda.exigir.mockImplementationOnce(async () => { throw new Error('NEXT_REDIRECT') })
  await expect(historicoDaAgendaAcao(UUID_VALIDO)).rejects.toThrow('NEXT_REDIRECT')
  expect(ler).not.toHaveBeenCalled()
})

test.each([['', 'vazio'], ['abc', 'não uuid'], ['../../etc', 'travessia']])
  ('id inválido (%s) é recusado sem tocar no banco', async (id) => {
    expect(await historicoDaAgendaAcao(id)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
    expect(ler).not.toHaveBeenCalled()
  })

test('id válido delega com a identidade da sessão, nunca com id vindo do cliente', async () => {
  await historicoDaAgendaAcao(UUID_VALIDO)
  expect(ler).toHaveBeenCalledWith('eu', UUID_VALIDO)
})
