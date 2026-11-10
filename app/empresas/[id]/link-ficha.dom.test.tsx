// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { lerFichaEmpresaAcao } from './ficha-acao'
import { LinkFichaEmpresa } from './link-ficha'

vi.mock('./ficha-acao', () => ({ lerFichaEmpresaAcao: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ onNavigate, prefetch, ...props }: ComponentProps<'a'> & { onNavigate?: (evento: { preventDefault: () => void }) => void; prefetch?: boolean }) =>
    <a {...props} data-prefetch={prefetch} onClick={evento => {
      if (evento.button === 0 && !evento.ctrlKey && !evento.metaKey && !evento.shiftKey && !evento.altKey) {
        onNavigate?.({ preventDefault: () => evento.preventDefault() })
      }
    }} />,
}))

const ler = vi.mocked(lerFichaEmpresaAcao)
const href = '/empresas/11111111-1111-4111-8111-111111111111?pagina=2'
const outroHref = '/empresas/22222222-2222-4222-8222-222222222222'

function resposta(nome: string, contatoNome: string, historico = false): Awaited<ReturnType<typeof lerFichaEmpresaAcao>> {
  return { ok: true, abaInicial: historico ? 'historico' : 'dados', origemHistorico: undefined, ficha: {
    empresa: {
      id: '11111111-1111-4111-8111-111111111111', nome, contatoNome, cnpj: null, razaoSocial: null, nomeFantasia: null,
      telefone: null, email: null, cnae: null, cep: null, logradouro: null, bairro: null, cidade: null, uf: null,
      responsavel: null, responsavelAtivo: null, situacao: 'a_contatar', proximoPasso: null, retorno: null, grupos: [],
    },
    cadastrais: null, socios: [], historico: { ok: true, contatos: [] },
    coletas: historico ? [{ pedidoId: '22222222-2222-4222-8222-222222222222', dia: '2026-11-10', vendedor: 'Ana', nicho: 'Iluminação', situacao: 'entregue' }] : [],
  } }
}
const painel = () => document.querySelector('[data-painel-lateral]')
const fechar = () => painel()?.querySelector<HTMLButtonElement>('header button')?.click()
const aguardarRadix = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
function clicarSemNavegar(link: HTMLAnchorElement, opcoes?: MouseEventInit) {
  document.addEventListener('click', evento => evento.preventDefault(), { once: true })
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...opcoes }))
}
let host: HTMLDivElement
let raiz: ReturnType<typeof createRoot>

beforeEach(() => {
  ler.mockReset()
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
})

afterEach(async () => {
  await act(async () => raiz.unmount())
  host.remove()
})

test('abre a ficha com o link intacto e devolve o foco sem remontar a origem', async () => {
  ler.mockResolvedValue(resposta('Aurora', 'Dados completos'))
  await act(async () => raiz.render(<><input defaultValue="filtro" /><LinkFichaEmpresa href={href}>Ficha completa</LinkFichaEmpresa></>))
  const filtro = host.querySelector('input')!
  const gatilho = host.querySelector('a')!
  filtro.value = 'minha busca'
  expect(gatilho.getAttribute('href')).toBe(href)

  await act(async () => { gatilho.focus(); gatilho.click() })
  await aguardarRadix()
  expect(ler).toHaveBeenCalledWith(href)
  expect(painel()?.textContent).toContain('Dados completos')
  expect(painel()?.querySelector('h2')?.textContent).toBe('Aurora')
  expect(document.activeElement).toBe(painel()?.querySelector('h2'))

  await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  await aguardarRadix()
  expect(painel()).toBeNull()
  expect(document.activeElement).toBe(gatilho)
  expect(host.querySelector('input')).toBe(filtro)
  expect(filtro.value).toBe('minha busca')
})

test('ignora resposta após fechar, mantém a nova ficha e permite repetir uma falha', async () => {
  let resolverAnterior!: (resultado: Awaited<ReturnType<typeof lerFichaEmpresaAcao>>) => void
  ler.mockReturnValueOnce(new Promise(resolve => { resolverAnterior = resolve }))
    .mockRejectedValueOnce(new Error('queda na conexão'))
    .mockResolvedValueOnce(resposta('Boreal', 'Dados da Boreal'))
  await act(async () => raiz.render(<><LinkFichaEmpresa href={href}>Aurora</LinkFichaEmpresa><LinkFichaEmpresa href={outroHref}>Boreal</LinkFichaEmpresa></>))
  const [primeiro, segundo] = host.querySelectorAll('a')

  await act(async () => primeiro.click())
  expect(painel()?.querySelector('[role="status"]')?.textContent).toContain('Carregando')
  await act(async () => fechar())
  await aguardarRadix()
  await act(async () => segundo.click())
  expect(painel()?.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível')
  const tentar = [...painel()!.querySelectorAll('button')].find(botao => botao.textContent === 'Tentar novamente')!
  await act(async () => tentar.click())
  await act(async () => resolverAnterior(resposta('Aurora', 'Resposta antiga')))
  expect(painel()?.textContent).toContain('Dados da Boreal')
  expect(painel()?.textContent).not.toContain('Resposta antiga')
  expect(ler.mock.calls).toEqual([[href], [outroHref], [outroHref]])
})

test('mantém cliques modificados como links e fecha quando o histórico navega à coleta', async () => {
  ler.mockResolvedValue(resposta('Aurora', 'Dados completos', true))
  await act(async () => raiz.render(<LinkFichaEmpresa href={href}>Ficha completa</LinkFichaEmpresa>))
  const gatilho = host.querySelector('a')!
  await act(async () => clicarSemNavegar(gatilho, { ctrlKey: true }))
  expect(ler).not.toHaveBeenCalled()
  expect(painel()).toBeNull()

  await act(async () => gatilho.click())
  await aguardarRadix()
  const coleta = painel()!.querySelector('a')!
  await act(async () => clicarSemNavegar(coleta, { metaKey: true }))
  expect(painel()).not.toBeNull()
  await act(async () => clicarSemNavegar(coleta))
  expect(painel()).toBeNull()
})

test('invalida a leitura quando a tela reaproveita o acionador para outro endereço', async () => {
  let resolverAnterior!: (resultado: Awaited<ReturnType<typeof lerFichaEmpresaAcao>>) => void
  ler.mockReturnValueOnce(new Promise(resolve => { resolverAnterior = resolve }))
  const mostrar = (endereco: string) => act(async () => raiz.render(<LinkFichaEmpresa href={endereco}>Ficha completa</LinkFichaEmpresa>))
  await mostrar(href)
  await act(async () => host.querySelector('a')!.click())
  expect(painel()?.querySelector('[role="status"]')).not.toBeNull()

  await mostrar(outroHref)
  expect(painel()).toBeNull()
  await mostrar(href)
  await act(async () => resolverAnterior(resposta('Aurora', 'Resposta antiga')))
  expect(painel()).toBeNull()
  expect(ler).toHaveBeenCalledOnce()
})
