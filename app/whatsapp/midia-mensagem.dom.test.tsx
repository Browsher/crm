// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MidiaMensagem } from './midia-mensagem'
import { TemaCrmContext } from '@/src/components/crm/tema'

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
test('carrega sob demanda e amplia na mesma lateral, sem nova consulta', async () => {
  await act(async () => raiz.render(<TemaCrmContext.Provider value="dark"><MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem', legenda: 'Foto do pedido' }} /></TemaCrmContext.Provider>))
  expect(fetcher).not.toHaveBeenCalled()
  await act(async () => host.querySelector('button')!.click())
  expect(fetcher).toHaveBeenCalledWith('/whatsapp/midia/ABC?conversa=123%40lid', expect.objectContaining({ credentials: 'same-origin' }))
  expect(host.querySelector('img')?.src).toBe('blob:midia')
  await act(async () => host.querySelector('button')!.click())
  const painel = document.querySelector('[role="dialog"]')!
  expect(painel.getAttribute('data-slot')).toBe('painel-lateral-content')
  expect(painel.closest('[data-theme]')?.getAttribute('data-theme')).toBe('dark')
  const corpo = painel.querySelector<HTMLElement>('[data-painel-corpo]')!
  const imagem = corpo.querySelector('img')
  expect(imagem?.getAttribute('src')).toBe('blob:midia')
  expect(corpo.querySelector('figcaption')?.textContent).toBe('Foto do pedido')
  expect(corpo.querySelector('figure')?.tabIndex).toBe(0)
  const ampliar = painel.querySelector<HTMLButtonElement>('[data-painel-rodape] button')!
  expect(ampliar.textContent).toBe('Ampliar imagem')
  corpo.scrollTop = 128

  await act(async () => ampliar.click())
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(document.querySelector('[role="dialog"]')).toBe(painel)
  expect(painel.querySelector('h2')?.textContent).toBe('Imagem ampliada')
  expect(corpo.querySelector('img')).toBe(imagem)
  expect(corpo.querySelector('figcaption')).toBeNull()
  expect(painel.querySelector('[data-painel-rodape]')).toBeNull()
  expect(corpo.scrollTop).toBe(0)

  await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(painel.querySelector('h2')?.textContent).toBe('Imagem da conversa')
  expect(corpo.querySelector('figcaption')?.textContent).toBe('Foto do pedido')
  expect(corpo.scrollTop).toBe(128)
  expect(document.activeElement).toBe(painel.querySelector('[data-painel-rodape] button'))
  expect(revogar).not.toHaveBeenCalled()
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
  expect(host.querySelector('[role="alert"]')?.getAttribute('data-slot')).toBe('alert')
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
  await act(async () => raiz.render(<MidiaMensagem key="outra" id="ABC" conversa="456@lid" fonte="fonte-2" midia={{ tipo: 'imagem' }} />))
  expect(signal.aborted).toBe(true)
  fetcher.mockResolvedValueOnce(new Response(new Blob(['outra foto'])))
  await act(async () => host.querySelector('button')!.click())
  expect(fetcher).toHaveBeenLastCalledWith('/whatsapp/midia/ABC?conversa=456%40lid&fonte=fonte-2', expect.anything())
  await act(async () => concluir(new Response(new Blob(['foto']))))
  expect(criar).toHaveBeenCalledTimes(1)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

test('fechar imagem devolve foco à miniatura sem repetir download', async () => {
  await act(async () => raiz.render(<MidiaMensagem id="ABC" conversa="123@lid" midia={{ tipo: 'imagem' }} />))
  await act(async () => host.querySelector('button')!.click())
  const miniatura = host.querySelector<HTMLButtonElement>('[aria-label="Ampliar imagem"]')!
  miniatura.focus()
  await act(async () => miniatura.click())
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  const fechar = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(botao => botao.textContent === 'Fechar')!
  await act(async () => fechar.click())
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(document.activeElement).toBe(miniatura)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
