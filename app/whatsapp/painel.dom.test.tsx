// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PainelWhatsApp } from './painel'
import type { Mensagem } from '@/src/server/whatsapp/evolution'

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
let raiz: ReturnType<typeof createRoot>
let host: HTMLDivElement
const mensagens: Mensagem[] = [
  { id: '1', conversa: 'a@lid', nome: 'Ana', direcao: 'recebida', texto: 'Mensagem A', em: '2026-09-21T15:00:00Z' },
  { id: '2', conversa: 'b@lid', nome: 'Bia', direcao: 'recebida', texto: 'Mensagem B', em: '2026-09-21T16:00:00Z' },
]
beforeEach(() => {
  vi.useFakeTimers()
  router.refresh.mockClear()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
})
afterEach(async () => {
  await act(async () => raiz.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
test('atualiza periodicamente mesmo vazio e encerra consultas ao sair', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[]} />))
  await act(async () => vi.advanceTimersByTime(15_000))
  expect(router.refresh).toHaveBeenCalledTimes(1)
  await act(async () => raiz.render(null))
  await act(async () => vi.advanceTimersByTime(30_000))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(router.refresh).toHaveBeenCalledTimes(1)
})
test('pausa oculta ou offline e consulta ao retornar', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} />))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => vi.advanceTimersByTime(30_000))
  expect(router.refresh).not.toHaveBeenCalled()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(router.refresh).toHaveBeenCalledTimes(1)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await act(async () => vi.advanceTimersByTime(30_000))
  expect(router.refresh).toHaveBeenCalledTimes(1)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(router.refresh).toHaveBeenCalledTimes(2)
})
test('novos dados preservam a conversa escolhida e mostram a mensagem nova', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} />))
  await act(async () => host.querySelectorAll('button')[1].click())
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[...mensagens, { ...mensagens[0], id: '3', texto: 'Nova resposta', em: '2026-09-21T17:00:00Z' }]} />))
  expect(host.querySelector('button[aria-current="true"]')?.textContent).toContain('Ana')
  expect(host.querySelector('ol')?.textContent).toContain('Nova resposta')
  expect(host.querySelector('ol')?.textContent).not.toContain('Mensagem B')
})
