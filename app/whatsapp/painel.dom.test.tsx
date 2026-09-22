// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PainelWhatsApp } from './painel'
import type { Mensagem } from '@/src/server/whatsapp/evolution'
import { historicoMensagensAcao, historicoFontesAcao } from './historico-acao'

vi.mock('./historico-acao', () => ({ historicoMensagensAcao: vi.fn(), historicoFontesAcao: vi.fn() }))
const historico = { limiteHistorico: '2026-09-21T20:00:00.000Z', temMais: true }

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
let raiz: ReturnType<typeof createRoot>
let host: HTMLDivElement
const mensagens: Mensagem[] = [
  { id: '1', conversa: 'a@lid', nome: 'Ana', direcao: 'recebida', texto: 'Mensagem A', em: '2026-09-21T15:00:00Z' },
  { id: '2', conversa: 'b@lid', nome: 'Bia', direcao: 'recebida', texto: 'Mensagem B', em: '2026-09-21T16:00:00Z' },
]
test('mesmo cliente e mesmo ID em vendedores distintos não misturam conversa', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[
    { ...mensagens[0], fonteId: 'a', vendedor: 'Vendedor A' },
    { ...mensagens[0], fonteId: 'b', vendedor: 'Vendedor B', texto: 'Segunda fonte' },
  ]} />))
  expect(host.textContent).toContain('2 mensagens carregadas')
  expect(host.querySelectorAll('button')).toHaveLength(2)
  expect(host.querySelectorAll('ol li')).toHaveLength(1)
  expect(host.textContent).toContain('Vendedor A')
  expect(host.textContent).toContain('Vendedor B')
})
test('remover outra fonte na atualização preserva seleção e histórico da fonte restante', async () => {
  const fontes = [
    { ...mensagens[0], fonteId: 'a', vendedor: 'Vendedor A' },
    { ...mensagens[1], fonteId: 'b', vendedor: 'Vendedor B' },
  ]
  await act(async () => raiz.render(<PainelWhatsApp mensagens={fontes} fontesAtivas={['a', 'b']} />))
  await act(async () => host.querySelectorAll('button')[1].click())
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[]} fontesAtivas={['a']} />))
  expect(host.textContent).toContain('Mensagem A')
  expect(host.textContent).not.toContain('Vendedor B')
  expect(host.querySelector('button[aria-current]')?.textContent).toContain('Ana')
})
test('resposta pendente de escopo antigo não reintroduz fonte removida', async () => {
  const cursores = { a: { pagina: 2, limite: historico.limiteHistorico, temMais: true }, b: { pagina: 2, limite: historico.limiteHistorico, temMais: true } }
  const a = { ...mensagens[0], fonteId: 'a', vendedor: 'Vendedor A' }
  const b = { ...mensagens[1], fonteId: 'b', vendedor: 'Vendedor B' }
  let concluir!: (r: Awaited<ReturnType<typeof historicoFontesAcao>>) => void
  vi.mocked(historicoFontesAcao).mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a, b]} fontesAtivas={['a', 'b']} cursores={cursores} {...historico} />))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a]} fontesAtivas={['a']} cursores={{ a: cursores.a }} {...historico} />))
  await act(async () => concluir({ ok: true, mensagens: [b], cursores, temMais: true, avisos: [] }))
  expect(host.textContent).not.toContain('Vendedor B')
  expect(host.textContent).toContain('1 mensagens carregadas')
})
test('falha pendente de escopo antigo não bloqueia o novo histórico', async () => {
  const cursores = { a: { pagina: 2, limite: historico.limiteHistorico, temMais: true }, b: { pagina: 2, limite: historico.limiteHistorico, temMais: true } }
  const a = { ...mensagens[0], fonteId: 'a' }
  let rejeitar!: (e: Error) => void
  vi.mocked(historicoFontesAcao).mockReturnValueOnce(new Promise((_resolve, reject) => { rejeitar = reject }))
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a]} fontesAtivas={['a', 'b']} cursores={cursores} {...historico} />))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a]} fontesAtivas={['a']} cursores={{ a: cursores.a }} {...historico} />))
  await act(async () => rejeitar(new Error('rede')))
  expect(host.querySelector('[role=alert]')).toBeNull()
})
beforeEach(() => {
  vi.useFakeTimers()
  router.refresh.mockClear()
  vi.mocked(historicoMensagensAcao).mockReset()
  vi.mocked(historicoFontesAcao).mockReset()
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
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.querySelectorAll('ol li')).toHaveLength(2)
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[{ ...mensagens[1], id: 'nova' }]} limiteHistorico="2026-09-22T20:00:00.000Z" temMais />))
  expect(host.querySelector('button[aria-current="true"]')?.textContent).toContain('Ana')
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem antiga')
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [], temMais: false })
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(historicoMensagensAcao).toHaveBeenNthCalledWith(1, 2, historico.limiteHistorico)
  expect(historicoMensagensAcao).toHaveBeenNthCalledWith(2, 3, historico.limiteHistorico)
  expect(host.textContent).toContain('Fim do histórico')
})

test('falha mantém mensagens e tenta a mesma página pelo botão de recuperação', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  let concluir!: (r: Awaited<ReturnType<typeof historicoMensagensAcao>>) => void
  vi.mocked(historicoMensagensAcao).mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
  await act(async () => concluir({ ok: false, motivo: 'indisponivel' }))
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Tente novamente')
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem B')
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [], temMais: false })
  const botao = [...host.querySelectorAll('button')].find(b => b.textContent === 'Tentar novamente')!
  await act(async () => { botao.click(); botao.click() })
  expect(historicoMensagensAcao).toHaveBeenLastCalledWith(2, historico.limiteHistorico)
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(2)
})

test('amostra vazia permite buscar histórico e IDs iguais em conversas diferentes são preservados', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[]} {...historico} />))
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [mensagens[0], { ...mensagens[1], id: mensagens[0].id }], temMais: false })
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.textContent).toContain('2 mensagens carregadas')
  expect(host.querySelectorAll('button')).toHaveLength(2)
})

test('erro de transporte não expõe detalhes e permite nova tentativa', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  vi.mocked(historicoMensagensAcao).mockRejectedValueOnce(new Error('segredo-ficticio'))
  await act(async () => vi.advanceTimersByTimeAsync(500))
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

async function buscar(valor: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="search"]')!
  expect(input).not.toBeNull()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

test('busca nome sem acento, telefone formatado e texto sem perder a seleção', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[{ ...mensagens[0], nome: 'Âna', telefone: '+5511999998888' }, mensagens[1]]} />))
  await buscar('ana')
  expect(host.querySelectorAll('button[aria-current]')).toHaveLength(0)
  expect(host.textContent).toContain('Âna')
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem B')
  await buscar('(11) 99999-8888')
  expect(host.querySelector('[aria-label="Lista de conversas"]')?.textContent).toContain('Âna')
  await buscar('Mensagem A')
  expect(host.querySelector('[aria-label="Lista de conversas"]')?.textContent).toContain('Âna')
  await buscar('inexistente')
  expect(host.textContent).toContain('Nenhuma conversa encontrada')
  await buscar('')
  expect(host.querySelector('button[aria-current="true"]')?.textContent).toContain('Bia')
})

test('rolar ao fim da lista carrega uma página e não repete automaticamente após erro', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  const lista = host.querySelector<HTMLElement>('[aria-label="Lista de conversas"]')!
  expect(lista).not.toBeNull()
  Object.defineProperties(lista, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 } })
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: false, motivo: 'indisponivel' })
  await act(async () => { lista.scrollTop = 690; lista.dispatchEvent(new Event('scroll')) })
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
  await act(async () => lista.dispatchEvent(new Event('scroll')))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
})

test('carregar pelo topo mantém âncora e nova mensagem não arrasta quem está lendo acima', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  const chat = host.querySelector<HTMLOListElement>('ol')!
  Object.defineProperties(chat, { scrollHeight: { configurable: true, get: () => chat.querySelectorAll('li').length >= 3 ? 1200 : 1000 }, clientHeight: { configurable: true, value: 300 } })
  await act(async () => { chat.scrollTop = 250; chat.dispatchEvent(new Event('scroll')) })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[...mensagens, { ...mensagens[1], id: 'nova', em: '2026-09-21T17:00:00Z' }]} {...historico} />))
  expect(chat.scrollTop).toBe(250)
  vi.mocked(historicoMensagensAcao).mockImplementationOnce(async () => {
    return { ok: true, mensagens: [{ ...mensagens[1], id: 'antiga', em: '2026-09-20T15:00:00Z' }], temMais: true }
  })
  await act(async () => { chat.scrollTop = 20; chat.dispatchEvent(new Event('scroll')) })
  expect(historicoMensagensAcao).toHaveBeenCalledOnce()
  expect(chat.scrollTop).toBe(220)
})

test('continuar rolando no limite busca outra página mesmo sem aparecer conversa nova', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  const lista = host.querySelector<HTMLElement>('[aria-label="Lista de conversas"]')!
  Object.defineProperties(lista, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 300 } })
  vi.mocked(historicoMensagensAcao).mockResolvedValue({ ok: true, mensagens: [], temMais: true })
  await act(async () => { lista.scrollTop = 700; lista.dispatchEvent(new Event('scroll')) })
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
  await act(async () => lista.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true })))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(2)
})

test('histórico carrega sozinho até o fim e atualização recente não reinicia páginas', async () => {
  const antiga = { ...mensagens[0], id: 'antiga', texto: 'Histórico automático', em: '2026-09-20T15:00:00Z' }
  vi.mocked(historicoMensagensAcao)
    .mockResolvedValueOnce({ ok: true, mensagens: [antiga], temMais: true })
    .mockResolvedValueOnce({ ok: true, mensagens: [antiga], temMais: false })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} total={3} />))
  await act(async () => host.querySelectorAll('button')[1].click())
  const chat = host.querySelector<HTMLOListElement>('ol')!
  Object.defineProperties(chat, { scrollHeight: { configurable: true, get: () => chat.querySelectorAll('li').length > 1 ? 1200 : 1000 }, clientHeight: { configurable: true, value: 300 } })
  await act(async () => { chat.scrollTop = 250; chat.dispatchEvent(new Event('scroll')) })
  expect(host.textContent).toContain('2 de 3')
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(chat.textContent).toContain('Histórico automático')
  expect(chat.scrollTop).toBe(450)
  expect(host.querySelector('button[aria-current]')?.textContent).toContain('Ana')
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.textContent).toContain('Fim do histórico')
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[...mensagens]} {...historico} total={3} />))
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(2)
  expect(historicoMensagensAcao).toHaveBeenLastCalledWith(3, historico.limiteHistorico)
  expect(chat.querySelectorAll('li')).toHaveLength(2)
  expect(router.refresh).toHaveBeenCalled()
})

test('falha automática pausa sem perder dados e tentativa manual retoma o restante', async () => {
  vi.mocked(historicoMensagensAcao)
    .mockResolvedValueOnce({ ok: false, motivo: 'indisponivel' })
    .mockResolvedValueOnce({ ok: true, mensagens: [], temMais: true })
    .mockResolvedValueOnce({ ok: true, mensagens: [{ ...mensagens[1], id: 'antiga', texto: 'Recuperada' }], temMais: false })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.querySelector('[role=alert]')).not.toBeNull()
  expect(host.querySelector('ol')?.textContent).toContain('Mensagem B')
  await act(async () => vi.advanceTimersByTimeAsync(10_000))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Tentar novamente')!.click())
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.querySelector('ol')?.textContent).toContain('Recuperada')
  expect(historicoMensagensAcao).toHaveBeenNthCalledWith(2, 2, historico.limiteHistorico)
})

test('carga automática espera aba visível e internet e cancela agendamento ao sair', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  vi.mocked(historicoMensagensAcao).mockResolvedValue({ ok: true, mensagens: [{ ...mensagens[1], id: 'anterior', texto: 'Recente e antiga' }], temMais: true })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(historicoMensagensAcao).not.toHaveBeenCalled()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(historicoMensagensAcao).not.toHaveBeenCalled()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  await act(async () => window.dispatchEvent(new Event('online')))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.querySelector('ol')?.textContent).toContain('Recente e antiga')
  await act(async () => raiz.render(null))
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
})

test('carga por vendedor aguarda a página pendente e continua com os cursores retornados', async () => {
  const cursores = { a: { pagina: 2, limite: historico.limiteHistorico, temMais: true } }
  const seguintes = { a: { ...cursores.a, pagina: 3 } }
  let concluir!: (r: Awaited<ReturnType<typeof historicoFontesAcao>>) => void
  vi.mocked(historicoFontesAcao)
    .mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
    .mockResolvedValueOnce({ ok: true, mensagens: [], cursores: { a: { ...seguintes.a, temMais: false } }, temMais: false, avisos: [] })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[{ ...mensagens[0], fonteId: 'a' }]} fontesAtivas={['a']} filtro="a" cursores={cursores} {...historico} />))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  await act(async () => vi.advanceTimersByTimeAsync(30_000))
  expect(historicoFontesAcao).toHaveBeenCalledTimes(1)
  expect(router.refresh).not.toHaveBeenCalled()
  await act(async () => concluir({ ok: true, mensagens: [{ ...mensagens[0], fonteId: 'a', id: 'antiga', texto: 'Anterior do vendedor' }], cursores: seguintes, temMais: true, avisos: [] }))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(host.querySelector('ol')?.textContent).toContain('Anterior do vendedor')
  expect(host.textContent).toContain('Fim do histórico')
  expect(historicoFontesAcao).toHaveBeenNthCalledWith(2, 'a', seguintes)
  expect(historicoMensagensAcao).not.toHaveBeenCalled()
})

test('carga normal não oferece botão manual nem anuncia fim enquanto ainda há páginas', async () => {
  await act(async () => raiz.render(<PainelWhatsApp mensagens={mensagens} {...historico} />))
  expect([...host.querySelectorAll('button')].every(b => b.closest('[aria-label="Lista de conversas"]'))).toBe(true)
  expect(host.textContent).not.toContain('Fim do histórico')
  expect(host.textContent).toContain('Carregando histórico automaticamente')
})

test('cards aguardam histórico completo e acompanham novas mensagens sem nova carga', async () => {
  const referencia = '2026-09-22T20:00:00Z'
  const recebida = { ...mensagens[0], fonteId: 'a', em: '2026-09-22T12:00:00Z' }
  const props = { opcoes: [{ id: 'a', nome: 'Ana' }], fontesAtivas: ['a'], limiteHistorico: referencia, temMais: true }
  vi.mocked(historicoMensagensAcao).mockResolvedValueOnce({ ok: true, mensagens: [], temMais: false })
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[recebida]} {...props} />))
  const cards = () => [...host.querySelectorAll('article')]
  expect(cards()).toHaveLength(4)
  expect(cards()[0].textContent).toContain('Carregando histórico')
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(cards()[0].textContent).toContain('1')
  expect(cards()[1].textContent).toContain('1')
  expect(cards()[2].textContent).toContain('0 de 1')
  expect(cards()[3].textContent).toContain('Sem respostas hoje')
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[recebida, { ...recebida, id: 'resposta', direcao: 'enviada', em: '2026-09-22T12:15:00Z' }]} {...props} />))
  expect(cards()[1].textContent).toContain('0')
  expect(cards()[2].textContent).toContain('1 de 1')
  expect(cards()[3].textContent).toContain('15 min')
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(historicoMensagensAcao).toHaveBeenCalledTimes(1)
})

test('cards não apresentam números de consulta parcial e retiram vendedor removido', async () => {
  const a = { ...mensagens[0], fonteId: 'a', em: '2026-09-22T12:00:00Z' }
  const b = { ...mensagens[1], fonteId: 'b', em: '2026-09-22T13:00:00Z' }
  const props = { opcoes: [{ id: 'a', nome: 'Ana' }, { id: 'b', nome: 'Bia' }], limiteHistorico: '2026-09-22T20:00:00Z' }
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a, b]} fontesAtivas={['a', 'b']} {...props} consultaParcial />))
  const valores = () => [...host.querySelectorAll('article')].map(c => c.querySelector('p')?.textContent)
  expect(valores()).toEqual(['—', '—', '—', '—'])
  expect(host.querySelector('article')?.textContent).toContain('Histórico incompleto')
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a, b]} fontesAtivas={['a', 'b']} {...props} />))
  expect(valores()).toEqual(['2', '2', '0 de 2', '—'])
  await act(async () => raiz.render(<PainelWhatsApp mensagens={[a]} fontesAtivas={['a']} {...props} />))
  expect(valores()).toEqual(['1', '1', '0 de 1', '—'])
})
