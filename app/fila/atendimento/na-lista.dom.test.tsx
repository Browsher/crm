// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
import { Cartao } from '../cartao'
import { AtendimentoNaLista } from './na-lista'

const m = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), iniciar: vi.fn(), retomar: vi.fn(), registrar: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push, back: m.back, refresh: m.refresh }) }))
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerDetalhesEmpresaAcao: vi.fn() }))
vi.mock('@/src/features/contato/acao', () => ({ prepararContatoAcao: vi.fn(), registrarContatoAcao: m.registrar }))
vi.mock('./acoes', () => ({ iniciarAtendimentoAcao: m.iniciar, retomarAtendimentoAcao: m.retomar }))

const empresa: ResumoEmpresa = { referencia: { tipo: 'cadastro', empresaId: 'empresa' }, id: 'empresa', nome: 'Loja Aurora',
  cnpj: null, cnae: null, atividade: null, bairro: null, cidade: null, uf: null, origens: ['banco'], recebidaEm: null,
  situacao: 'atendimento', versao: 2, negociacaoId: null }
const dados = { empresaId: 'empresa', empresa, fase: 'inicial' as const, contatos: [], filtros: { origem: 'banco' as const } }
const leitura = { ok: true as const, dados }
const confirmacao = { ok: true, versao: 2, repetida: false, leituraDestino: { ok: true, destino: { tipo: 'atendimento', empresaId: 'empresa' } } }

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  history.replaceState(null, '', '/')
})

async function montar(carregarAcao: ComponentProps<typeof AtendimentoNaLista>['carregarAcao'], situacao = empresa.situacao) {
  await act(async () => root.render(<AtendimentoNaLista carregarAcao={carregarAcao}>
    <Cartao empresa={{ ...empresa, situacao, versao: situacao === 'a_contatar' ? 1 : 2 }} />
    <Cartao empresa={{ ...empresa, id: 'outra', referencia: { tipo: 'cadastro', empresaId: 'outra' }, nome: 'Outra loja' }} />
  </AtendimentoNaLista>))
}

function botao(texto: string) { return [...document.querySelectorAll('button')].find(b => b.textContent === texto)! }
async function clicar(texto: string) { await act(async () => { const b = botao(texto); b.focus(); b.click() }) }
function painel() { return document.querySelector('[data-painel-lateral]') }

function recarregarEntradaProtegida() {
  history.replaceState({ __NA: true }, '', '/fila/google/entrega?pagina=2')
  const href = location.href
  const entrada = { index: 1, url: href, key: 'entrada-protegida' }
  vi.stubGlobal('navigation', { currentEntry: entrada, entries: () => [{ url: href }, entrada] })
  sessionStorage.setItem('crm:carteira:entrada-edicao', JSON.stringify({ entrada: entrada.key, id: 'sentinela' }))
}

test('continuar abre uma lateral sem navegar e fechar devolve o foco ao mesmo card', async () => {
  const carregar = vi.fn().mockResolvedValue(leitura)
  await montar(carregar)
  const gatilho = botao('Continuar atendimento')
  await clicar('Continuar atendimento')
  expect(carregar).toHaveBeenCalledExactlyOnceWith('empresa')
  expect(painel()?.querySelector('textarea[name="nota"]')).not.toBeNull()
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(host.contains(gatilho)).toBe(true)
  await clicar('Fechar')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(painel()).toBeNull()
  expect(document.activeElement).toBe(gatilho)
  expect(m.push).not.toHaveBeenCalled()
  expect(m.back).not.toHaveBeenCalled()
})

test('enquanto confirma o início, outro card não abre painel e repetir leitura não inicia de novo', async () => {
  let confirmar!: (r: typeof confirmacao) => void
  m.iniciar.mockImplementationOnce(() => new Promise(resolve => { confirmar = resolve }))
  const carregar = vi.fn().mockRejectedValueOnce(new Error('leitura')).mockResolvedValueOnce(leitura)
  await montar(carregar, 'a_contatar')
  await clicar('Iniciar atendimento')
  expect(botao('Continuar atendimento').disabled).toBe(true)
  await clicar('Continuar atendimento')
  expect(carregar).not.toHaveBeenCalled()
  await act(async () => confirmar(confirmacao))
  expect(painel()?.querySelector('[role="alert"]')).not.toBeNull()
  await clicar('Tentar novamente')
  expect(painel()?.querySelector('textarea[name="nota"]')).not.toBeNull()
  expect(m.iniciar).toHaveBeenCalledOnce()
  expect(m.push).not.toHaveBeenCalled()
})

test('fechar durante a leitura descarta a resposta antiga', async () => {
  let concluir!: (r: typeof leitura) => void
  const carregar = vi.fn().mockImplementationOnce(() => new Promise(resolve => { concluir = resolve }))
  await montar(carregar)
  await clicar('Continuar atendimento')
  expect(painel()?.textContent).toContain('Carregando atendimento')
  await clicar('Fechar')
  await act(async () => concluir(leitura))
  expect(painel()).toBeNull()
  expect(m.push).not.toHaveBeenCalled()
})

test('resposta de início na aba oculta atualiza o cartão sem abrir o painel', async () => {
  let confirmar!: (r: typeof confirmacao) => void
  m.iniciar.mockImplementationOnce(() => new Promise(resolve => { confirmar = resolve }))
  const carregar = vi.fn().mockResolvedValue(leitura)
  await montar(carregar, 'a_contatar')
  await clicar('Iniciar atendimento')
  host.setAttribute('inert', '')
  await act(async () => confirmar(confirmacao))
  expect(carregar).not.toHaveBeenCalled()
  expect(painel()).toBeNull()
  expect(m.refresh).toHaveBeenCalledOnce()
  expect(m.push).not.toHaveBeenCalled()
})

test('reload da entrada de edição reabre o painel e oferece confirmação com a chave preservada', async () => {
  recarregarEntradaProtegida()
  const valor = { tipo: 'nao_atendeu', nota: 'Retorno preservado', proximoPasso: '', proximoPassoData: '' }
  sessionStorage.setItem('crm:contato:v1:empresa', JSON.stringify({ valor, envio: { valor, chave: 'chave-anterior', versao: 2 } }))
  const empilhar = vi.spyOn(history, 'pushState')
  m.registrar.mockResolvedValueOnce({ ok: false, erro: 'Falha de teste' })
  await montar(vi.fn().mockResolvedValue(leitura))
  await clicar('Continuar atendimento')
  expect(painel()).not.toBeNull()
  expect(empilhar).not.toHaveBeenCalled()
  await clicar('Confirmar envio anterior')
  expect(m.registrar).toHaveBeenCalledOnce()
  expect(m.registrar.mock.calls[0][1].get('chave')).toBe('chave-anterior')
})

test('reload com anotação ainda não enviada reabre o rascunho sem retirar a entrada', async () => {
  recarregarEntradaProtegida()
  const valor = { tipo: 'nao_liguei', nota: 'Retorno preservado', proximoPasso: '', proximoPassoData: '' }
  sessionStorage.setItem('crm:contato:v1:empresa', JSON.stringify({ valor, envio: null }))
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  await montar(vi.fn().mockResolvedValue(leitura))
  await clicar('Continuar atendimento')
  expect(painel()?.querySelector<HTMLTextAreaElement>('textarea[name="nota"]')?.value).toBe(valor.nota)
  expect(voltar).not.toHaveBeenCalled()
  expect(m.registrar).not.toHaveBeenCalled()
})
