// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { EventoAtividade, PaginaAtividade } from '@/src/lib/atividade-gestao'
import { AtividadeRecente } from './painel'

const { consulta } = vi.hoisted(() => ({ consulta: vi.fn<() => Promise<PaginaAtividade | null>>() }))
vi.mock('./acoes', () => ({ consultarAtividadeAcao: consulta }))

const venda: EventoAtividade = {
  id: 'venda-1', categoria: 'venda', vendedorId: 'ana', vendedor: 'Ana', em: '2026-11-13T14:00:00Z',
  subtipo: 'primeira_venda', empresaId: 'empresa-1', empresa: 'Casa Ipê',
  dados: { valorCentavos: '128000', dataVenda: '2026-11-13' },
}
const contato: EventoAtividade = {
  id: 'contato-1', categoria: 'contato', vendedorId: 'ana', vendedor: 'Ana', em: '2026-11-13T02:30:00Z',
  subtipo: 'nao_atendeu', empresaId: 'empresa-2', empresa: 'Estúdio Cedro',
  dados: { nota: 'Enviar catálogo.' },
}
const falha: EventoAtividade = {
  id: 'busca-1', categoria: 'banco', vendedorId: 'junior', vendedor: 'Junior', em: '2026-11-13T13:00:00Z',
  subtipo: 'falhou', empresaId: null, empresa: null,
  dados: { solicitadas: 20, motivo: 'O fornecedor não respondeu a tempo.' },
}

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-13T15:00:00Z'))
  consulta.mockReset()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})

function dialogo() {
  const elemento = document.querySelector<HTMLElement>('[role="dialog"]')
  expect(elemento).not.toBeNull()
  return elemento!
}

function botao(nome: string, base: ParentNode = document) {
  const elemento = [...base.querySelectorAll<HTMLButtonElement>('button')].find(botao => botao.textContent?.trim() === nome)
  expect(elemento, nome).toBeDefined()
  return elemento!
}

async function clicar(alvo: HTMLButtonElement) {
  await act(async () => { alvo.focus(); alvo.click() })
}

function filtro(nome: string) {
  const elemento = [...dialogo().querySelectorAll('select')].find(select => select.labels?.[0]?.firstChild?.textContent === nome)
  expect(elemento, nome).toBeDefined()
  return elemento!
}

async function selecionar(nome: string, valor: string) {
  const select = filtro(nome)
  await act(async () => {
    select.value = valor
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

test('agrupa registros pelo dia de Brasília, inclusive na virada da data UTC', async () => {
  consulta.mockResolvedValue({ eventos: [venda, contato], total: 2 })
  await act(async () => root.render(<AtividadeRecente destaques={[]} />))
  expect(consulta).not.toHaveBeenCalled()
  await clicar(botao('Ver atividade completa', host))

  const painel = dialogo()
  expect(painel.querySelector('h2')?.textContent).toBe('Atividade completa')
  expect(filtro('Período').selectedOptions[0]?.textContent).toBe('Últimos 7 dias')
  const grupos = [...painel.querySelectorAll('h3')]
  expect(grupos.map(titulo => titulo.textContent)).toEqual(['Hoje', 'Ontem'])
  expect(grupos[0].nextElementSibling?.querySelector('time')?.textContent).toBe('11:00')
  expect(grupos[1].nextElementSibling?.querySelector('time')?.textContent).toBe('23:30')
})

test('usa o dia da renderização inicial nos destaques e atualiza a referência ao abrir o histórico', async () => {
  consulta.mockResolvedValue({ eventos: [venda], total: 1 })
  vi.setSystemTime(new Date('2026-11-14T03:01:00Z'))
  await act(async () => root.render(<AtividadeRecente destaques={[venda]} hoje="2026-11-14T02:59:00Z" />))
  expect(host.querySelector('time')?.textContent).toBe('Hoje, 11:00')

  await clicar(botao('Ver atividade completa', host))
  expect(dialogo().querySelector('h3')?.textContent).toBe('Ontem')
})

test('volta do detalhe para a mesma lista, filtro, posição e ação', async () => {
  consulta.mockResolvedValue({ eventos: [venda], total: 1 })
  await act(async () => root.render(<AtividadeRecente destaques={[]} vendedores={[{ id: 'ana', nome: 'Ana' }]} />))
  const abrir = botao('Ver atividade completa', host)
  await clicar(abrir)
  await selecionar('Vendedor', 'ana')

  const painel = dialogo()
  const corpo = painel.querySelector<HTMLElement>('[data-painel-corpo]')!
  const acao = botao('Ver empresa', painel)
  corpo.scrollTop = 124
  await clicar(acao)
  expect(dialogo()).toBe(painel)
  expect(painel.querySelector('h2')?.textContent).toBe('Histórico da empresa')
  expect(painel.querySelector('dl')?.textContent).toContain('Casa Ipê')
  expect(corpo.scrollTop).toBe(0)

  await clicar(botao('Voltar', painel))
  expect(painel.querySelector('h2')?.textContent).toBe('Atividade completa')
  expect(filtro('Vendedor').value).toBe('ana')
  expect(corpo.scrollTop).toBe(124)
  expect(document.activeElement).toBe(acao)
  expect(consulta).toHaveBeenCalledTimes(2)

  await clicar(botao('Fechar', painel))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(abrir)
})

test('perfil consulta apenas seu vendedor e volta à primeira página ao alterar filtros', async () => {
  consulta.mockResolvedValue({ eventos: [venda], total: 21 })
  await act(async () => root.render(<AtividadeRecente destaques={[venda]} perfil={{ id: 'ana', nome: 'Ana' }} />))
  await clicar(botao('Ver atividade completa', host))
  const painel = dialogo()
  expect([...painel.querySelectorAll('label')].map(label => label.firstChild?.textContent)).toEqual(['Período', 'Tipo'])
  expect(consulta).toHaveBeenLastCalledWith({ vendedorId: 'ana', periodo: 'sete-dias', tipo: 'todos', pagina: 1 })
  await clicar(botao('Próxima', painel))
  expect(consulta).toHaveBeenLastCalledWith({ vendedorId: 'ana', periodo: 'sete-dias', tipo: 'todos', pagina: 2 })
  expect(botao('Próxima', painel).disabled).toBe(true)
  await selecionar('Tipo', 'venda')
  expect(consulta).toHaveBeenLastCalledWith({ vendedorId: 'ana', periodo: 'sete-dias', tipo: 'venda', pagina: 1 })
})

test('mostra o carregamento e recupera a consulta depois de uma falha', async () => {
  let finalizar: (resultado: PaginaAtividade | null) => void = () => {}
  consulta.mockImplementationOnce(() => new Promise(resolve => { finalizar = resolve }))
  consulta.mockResolvedValueOnce({ eventos: [], total: 0 })
  await act(async () => root.render(<AtividadeRecente destaques={[]} />))
  await clicar(botao('Ver atividade completa', host))
  expect(dialogo().querySelector('[role="status"]')?.textContent).toContain('Carregando')

  await act(async () => finalizar(null))
  expect(dialogo().querySelector('[role="alert"]')).not.toBeNull()
  await clicar(botao('Tentar novamente', dialogo()))
  expect(dialogo().textContent).toContain('Nenhum registro com estes filtros.')
  expect(consulta.mock.calls[1]).toEqual(consulta.mock.calls[0])
})

test('abre a falha recente diretamente no detalhe sem consultar o histórico', async () => {
  await act(async () => root.render(<AtividadeRecente destaques={[]} alerta={falha} />))
  await clicar(botao('Ver falha', host))
  const painel = dialogo()
  expect(painel.querySelector('dl')?.textContent).toContain('O fornecedor não respondeu a tempo.')
  expect(painel.querySelector('header button')?.textContent).toBe('Fechar')
  expect(consulta).not.toHaveBeenCalled()
})
