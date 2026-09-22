// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MidiaMensagem } from './midia-mensagem'

let raiz: ReturnType<typeof createRoot>
let host: HTMLDivElement
const fetcher = vi.fn()
const criar = vi.fn(() => 'blob:midia')
const revogar = vi.fn()
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', fetcher)
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: criar })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revogar })
  fetcher.mockReset().mockResolvedValue(new Response(new Blob(['foto'], { type: 'image/png' })))
  criar.mockClear(); revogar.mockClear()
  host = document.createElement('div'); document.body.append(host); raiz = createRoot(host)
})
afterEach(async () => { await act(async () => raiz.unmount()); host.remove(); vi.unstubAllGlobals() })
test('carrega imagem sob demanda, amplia sem nova consulta e libera blob', async () => {
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem', legenda: 'Foto do pedido' }} />))
  expect(fetcher).not.toHaveBeenCalled()
  await act(async () => host.querySelector('button')!.click())
  expect(fetcher).toHaveBeenCalledWith('/whatsapp/midia/ABC?conversa=123%40lid', expect.objectContaining({ credentials: 'same-origin' }))
  expect(host.querySelector('img')?.src).toBe('blob:midia')
  await act(async () => host.querySelector('button')!.click())
  expect(document.querySelector('[role="dialog"] img')?.getAttribute('src')).toBe('blob:midia')
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => raiz.render(null))
  expect(revogar).toHaveBeenCalledWith('blob:midia')
})
test('áudio tem controles sem autoplay e documento permite baixar', async () => {
  await act(async () => raiz.render(<MidiaMensagem id="A" conversa="123@lid" midia={{ tipo: 'audio' }} />))
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('audio')?.controls).toBe(true)
  expect(host.querySelector('audio')?.autoplay).toBe(false)
  await act(async () => raiz.render(<MidiaMensagem key="doc" id="D" conversa="123@lid" midia={{ tipo: 'documento', nome: 'pedido.pdf' }} />))
  fetcher.mockResolvedValueOnce(new Response(new Blob(['pdf'])))
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('a')?.download).toBe('pedido.pdf')
  expect(host.querySelector('a')?.href).toBe('blob:midia')
})
test('falha mostra erro e permite tentar novamente', async () => {
  fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }))
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem' }} />))
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('indisponível')
  await act(async () => host.querySelector('button')!.click())
  expect(host.querySelector('img')).not.toBeNull()
})

test('atualização da mensagem preserva arquivo e evita download duplicado', async () => {
  let concluir!: (r: Response) => void
  fetcher.mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem' }} />))
  await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click() })
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => concluir(new Response(new Blob(['foto']))))
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem', legenda: 'Atualizada' }} />))
  expect(host.querySelector('img')?.src).toBe('blob:midia')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('sair da conversa cancela download sem criar blob depois de desmontar', async () => {
  let concluir!: (r: Response) => void
  fetcher.mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem' }} />))
  await act(async () => host.querySelector('button')!.click())
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal
  await act(async () => raiz.render(null))
  expect(signal.aborted).toBe(true)
  await act(async () => concluir(new Response(new Blob(['foto']))))
  expect(criar).not.toHaveBeenCalled()
})
