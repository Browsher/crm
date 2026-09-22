import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { lerMensagensRecentes, lerPaginaMensagens } from './evolution'

const limiteHistorico = '2026-09-21T20:00:00.000Z'

test('histórico entrega descritores de mídia sem URL, chave ou binário ao navegador', async () => {
  vi.stubEnv('EVOLUTION_API_URL', 'https://exemplo.up.railway.app')
  vi.stubEnv('EVOLUTION_API_KEY', 'segredo-sintetico')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'Piloto')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ messages: { total: 1, records: [{
    key: { id: 'foto', remoteJid: '123@lid', fromMe: false }, messageTimestamp: 1790000000,
    message: { imageMessage: { caption: 'Pedido', url: 'https://privado.example', mediaKey: 'segredo', jpegThumbnail: 'binario' } },
  }] } })))
  const r = await lerMensagensRecentes()
  expect(r.mensagens[0].midia).toEqual({ tipo: 'imagem', legenda: 'Pedido' })
  expect(JSON.stringify(r)).not.toMatch(/segredo|privado.example|binario/)
})

test('extrai telefone confirmado sem transformar LID ou grupo em telefone', async () => {
  vi.stubEnv('EVOLUTION_API_URL', 'https://exemplo.up.railway.app')
  vi.stubEnv('EVOLUTION_API_KEY', 'segredo-sintetico')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'Piloto')
  const chaves = [
    { remoteJid: '123456789012345@lid', remoteJidAlt: '5511999999999@s.whatsapp.net' },
    { remoteJid: '123456789012345@lid' },
    { remoteJid: '123456789012345@lid', remoteJidAlt: 'outro@lid' },
    { remoteJid: 'grupo@g.us', remoteJidAlt: '5511999999999@s.whatsapp.net' },
    { remoteJid: '5511888888888@s.whatsapp.net' },
    { remoteJid: '123@lid', remoteJidAlt: 'abc@s.whatsapp.net' },
  ]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: { total: 6, records: chaves.map((key, i) => ({ key: { ...key, id: String(i), fromMe: false }, messageTimestamp: 1790000000 })) } }))))
  const r = await lerMensagensRecentes()
  expect(r.mensagens.map(m => m.telefone ?? null)).toEqual(['+5511999999999', null, null, null, '+5511888888888', null])
  expect(r.mensagens[0].conversa).toBe(chaves[0].remoteJid)
})
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
    redirect: 'error', signal: expect.any(AbortSignal),
  })
  expect(resultado).toEqual({ configurado: true, total: 590, limiteHistorico, temMais: true, mensagens: [
    { id: 'm1', conversa: '5511999999999@s.whatsapp.net', telefone: '+5511999999999', nome: 'Cliente', direcao: 'recebida', texto: 'Olá', em: '2026-09-21T14:13:20.000Z' },
    { id: 'm2', conversa: '5511999999999@s.whatsapp.net', telefone: '+5511999999999', nome: null, direcao: 'enviada', texto: 'Resposta', em: '2026-09-21T14:14:20.000Z' },
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
