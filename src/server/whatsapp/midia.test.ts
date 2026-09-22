import { afterEach, expect, test, vi } from 'vitest'
import { lerMidia } from './midia'
import { descreverMidia } from '@/src/lib/whatsapp-midia'

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const registro = { key: { id: 'ABC', remoteJid: '123@lid' }, message: { imageMessage: { mimetype: 'image/png' } } }
function preparar(records = [registro], midia: unknown = { mimetype: 'image/png', base64: 'aGVsbG8=', fileName: 'foto.png' }) {
  vi.stubEnv('EVOLUTION_API_URL', 'https://evolution.example')
  vi.stubEnv('EVOLUTION_API_KEY', 'segredo')
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'Teste CRM')
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ messages: { records } })).mockResolvedValueOnce(Response.json(midia))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
test('descritor preserva legenda/nome, sem transportar segredos e sem abrir visualização única', () => {
  expect(descreverMidia({ imageMessage: { caption: 'Foto', url: 'privado', mediaKey: 'segredo' } })).toEqual({ tipo: 'imagem', legenda: 'Foto' })
  expect(descreverMidia({ documentWithCaptionMessage: { message: { documentMessage: { fileName: 'pedido.pdf' } } } })).toEqual({ tipo: 'documento', nome: 'pedido.pdf' })
  expect(descreverMidia({ viewOnceMessage: { message: { imageMessage: {} } } })).toBeNull()
})
test('baixa pela chave armazenada e instância do servidor, sem seguir redirecionamentos', async () => {
  const fetcher = preparar()
  const r = await lerMidia('ABC', '123@lid')
  expect(r.ok && Buffer.from(r.bytes).toString()).toBe('hello')
  expect(fetcher).toHaveBeenLastCalledWith('https://evolution.example/chat/getBase64FromMediaMessage/Teste%20CRM', expect.objectContaining({ redirect: 'error', cache: 'no-store', body: JSON.stringify({ message: { key: { id: 'ABC' } }, convertToMp4: false }) }))
})
test('não baixa arquivo de outra conversa nem ID ambíguo', async () => {
  const fetcher = preparar()
  expect(await lerMidia('ABC', '456@lid')).toEqual({ ok: false, motivo: 'nao_encontrada' })
  expect(fetcher).toHaveBeenCalledTimes(1)
  preparar([registro, registro])
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'nao_encontrada' })
})
test('rejeita imagem ativa, base64 inválido e resposta excessiva', async () => {
  preparar(undefined, { mimetype: 'image/svg+xml', base64: 'aGVsbG8=' })
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'indisponivel' })
  preparar(undefined, { mimetype: 'image/png', base64: '!!!' })
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'indisponivel' })
  const f = preparar()
  f.mockReset().mockResolvedValueOnce(Response.json({ messages: { records: [registro] } })).mockResolvedValueOnce(new Response('{}', { headers: { 'content-length': '99999999' } }))
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'muito_grande' })
})

test('interrompe resposta grande mesmo sem content-length', async () => {
  const fetcher = preparar()
  const cancelar = vi.fn()
  const corpo = new ReadableStream({
    pull(c) { c.enqueue(new Uint8Array(1024 * 1024)) },
    cancel: cancelar,
  })
  fetcher.mockReset().mockResolvedValueOnce(new Response(corpo))
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'muito_grande' })
  expect(cancelar).toHaveBeenCalledOnce()
})

test('falha de rede ou mídia expirada retorna erro sem conteúdo da resposta', async () => {
  const fetcher = preparar()
  fetcher.mockReset().mockRejectedValue(new Error('segredo'))
  expect(await lerMidia('ABC', '123@lid')).toEqual({ ok: false, motivo: 'indisponivel' })
})
