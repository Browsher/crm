import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { lerMensagensRecentes, lerPaginaMensagens } from './evolution'

const limiteHistorico = '2026-09-21T20:00:00.000Z'
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(limiteHistorico))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('consulta somente mensagens da instância de teste e reduz as duas direções', async () => {
  vi.stubEnv('EVOLUTION_API_URL', 'https://exemplo.up.railway.app')
  vi.stubEnv('EVOLUTION_API_KEY', 'segredo-sintetico')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'NTV Box - Suporte')
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: {
    total: 590, pages: 12, currentPage: 1, records: [
      { id: 'registro-1', key: { id: 'm1', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, pushName: 'Cliente', messageType: 'conversation', message: { conversation: 'Olá' }, messageTimestamp: 1790000000 },
      { id: 'registro-2', key: { id: 'm2', fromMe: true, remoteJid: '5511999999999@s.whatsapp.net' }, pushName: null, messageType: 'extendedTextMessage', message: { extendedTextMessage: { text: 'Resposta' } }, messageTimestamp: 1790000060 },
    ],
  } }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)

  const resultado = await lerMensagensRecentes()

  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledWith('https://exemplo.up.railway.app/chat/findMessages/NTV%20Box%20-%20Suporte', {
    method: 'POST', headers: { apikey: 'segredo-sintetico', 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, offset: 50, sort: 'desc', where: { messageTimestamp: { gte: '1970-01-01T00:00:00.000Z', lte: limiteHistorico } } }), cache: 'no-store',
  })
  expect(resultado).toEqual({ configurado: true, total: 590, limiteHistorico, temMais: true, mensagens: [
    { id: 'm1', conversa: '5511999999999@s.whatsapp.net', nome: 'Cliente', direcao: 'recebida', texto: 'Olá', em: '2026-09-21T14:13:20.000Z' },
    { id: 'm2', conversa: '5511999999999@s.whatsapp.net', nome: null, direcao: 'enviada', texto: 'Resposta', em: '2026-09-21T14:14:20.000Z' },
  ] })
})

test('sem configuração não chama a API nem expõe segredo', async () => {
  vi.stubEnv('EVOLUTION_API_URL', '')
  vi.stubEnv('EVOLUTION_API_KEY', '')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', '')
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)

  expect(await lerMensagensRecentes()).toEqual({ configurado: false, total: 0, mensagens: [], limiteHistorico, temMais: false })
  expect(fetch).not.toHaveBeenCalled()
})

test('histórico mantém limite temporal original e termina na última página', async () => {
  vi.stubEnv('EVOLUTION_API_URL', 'https://exemplo.up.railway.app')
  vi.stubEnv('EVOLUTION_API_KEY', 'segredo-sintetico')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'Piloto')
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ messages: { total: 590, records: [] } })))
  vi.stubGlobal('fetch', fetch)
  vi.setSystemTime(new Date('2026-09-22T20:00:00.000Z'))
  const segunda = await lerPaginaMensagens(2, limiteHistorico)
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ page: 2, offset: 50, sort: 'desc', where: { messageTimestamp: { gte: '1970-01-01T00:00:00.000Z', lte: limiteHistorico } } })
  expect(segunda.temMais).toBe(true)
  expect((await lerPaginaMensagens(12, limiteHistorico)).temMais).toBe(false)
})
