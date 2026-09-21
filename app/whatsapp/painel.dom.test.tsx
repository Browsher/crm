// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PainelWhatsApp } from './painel'
import type { Mensagem } from '@/src/server/whatsapp/evolution'
import { historicoMensagensAcao } from './historico-acao'

vi.mock('./historico-acao', () => ({ historicoMensagensAcao: vi.fn() }))
const historico = { limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: true }

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
  vi.mocked(historicoMensagensAcao).mockReset()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
})

test('carrega histórico sem duplicar, preserva seleção e mantém páginas durante atualização', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  await act(async () => host.querySelectorAll('button')[1].click())
  const anterior = { ...mensagens[0], id: 'antiga', texto: 'Mensagem antiga', em: '2026-09-20T15:00:00Z' }
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [anterior, mensagens[0]], temMais: true })
  const carregar = () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Carregar mensagens anteriores')!
  await act(async () => carregar().click())
  expect(host.querySelectorAll('ol li')).toHaveLength(2)
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[{ ...mensagens[1], id: 'nova' }]} limiteHistorico="2026-09-22T20:00:00.000Z" temMais />))
  expect(host.querySelector('button[aria-current="true"]')?.textContent).toContain('Ana')
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem antiga')
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [], temMais: false })
  await act(async () => carregar().click())
  expect(historicoMensagensAcao).toHaveBeenNthCalledWith(1, 2, historico.limiteHistorico)
  expect(historicoMensagensAcao).toHaveBeenNthCalledWith(2, 3, historico.limiteHistorico)
  expect(carregar()).toBeUndefined()
})

test('falha mantém mensagens e tenta a mesma página; bloqueia clique repetido', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  let concluir!: (r: Awaited<ReturnType<typeof historicoMensagensAcao>>) => void
  vi.mocked(historicoMensagensAcao).mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  const botao = [...host.querySelectorAll('button')].find(b => b.textContent === 'Carregar mensagens anteriores')!
  await act(async () => { botao.click(); botao.click() })
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
  expect(botao.disabled).toBe(true)
  await act(async () => concluir({ ok: false, motivo: 'indisponivel' }))
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Tente novamente')
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem B')
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [], temMais: false })
  await act(async () => botao.click())
  expect(historicoMensagensAcao).toHaveBeenLastCalledWith(2, historico.limiteHistorico)
})

test('amostra vazia permite buscar histórico e IDs iguais em conversas diferentes são preservados', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[]} {...historico} />))
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [mensagens[0], { ...mensagens[1], id: mensagens[0].id }], temMais: false })
  await act(async () => host.querySelector('button')!.click())
  expect(host.textContent).toContain('2 mensagens carregadas')
  expect(host.querySelectorAll('button')).toHaveLength(2)
})

test('erro de transporte não expõe detalhes e permite nova tentativa', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  vi.mocked(historicoMensagensAcao).mockRejectedValueOnce(new Error('segredo-ficticio'))
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Carregar mensagens anteriores')!.click())
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Tente novamente')
  expect(host.textContent).not.toContain('segredo-ficticio')
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
