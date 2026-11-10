// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { BuscaSalva, EmpresaEncontrada } from '@/src/features/busca-empresas/tipos'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
import { BuscaPainel } from '@/src/components/crm/busca-dialogo'
import { ResultadosBusca } from './resultados'

const m = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), iniciar: vi.fn(), retomar: vi.fn(), incluir: vi.fn(), registrar: vi.fn(), preparar: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push, back: m.back, refresh: m.refresh }) }))
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerDetalhesEmpresaAcao: vi.fn() }))
vi.mock('@/src/features/contato/acao', () => ({ prepararContatoAcao: m.preparar, registrarContatoAcao: m.registrar }))
vi.mock('../atendimento/acoes', () => ({ iniciarAtendimentoAcao: m.iniciar, retomarAtendimentoAcao: m.retomar }))
vi.mock('./acoes', () => ({ concluirInclusaoAcao: m.incluir }))

const encontrada: EmpresaEncontrada = { cnpj: '11222333000181', razao_social: 'Loja Aurora', nome_fantasia: null,
  email: null, telefone: '11999999999', cep: null, cnae_principal: '4742300', situacao: 'ATIVA', porte: 'ME',
  data_abertura: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: 'São Paulo', uf: 'SP', telefones: [] }
const busca = { id: 'busca', nome: 'Lojas SP', estado: 'concluida', empresas: [encontrada], grupo_id: null } as BuscaSalva
const empresa: ResumoEmpresa = { referencia: { tipo: 'cadastro', empresaId: 'empresa' }, id: 'empresa', nome: 'Loja Aurora',
  cnpj: encontrada.cnpj, cnae: '4742300', atividade: null, bairro: null, cidade: 'São Paulo', uf: 'SP', origens: ['banco'],
  recebidaEm: null, situacao: 'atendimento', versao: 2, negociacaoId: null }
const dados = { empresaId: 'empresa', empresa, fase: 'inicial' as const, contatos: [], filtros: { origem: 'banco' as const } }
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
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

function resultados(resumo: ResumoEmpresa) {
  return { ok: true as const, conteudo: <ResultadosBusca busca={busca} bloqueada={false} resumos={[resumo]} /> }
}

type Props = ComponentProps<typeof BuscaPainel>
async function montar(carregar: Props['carregarAcao'], carregarAtendimentoAcao?: Props['carregarAtendimentoAcao']) {
  await act(async () => root.render(<BuscaPainel nome="Lojas SP" carregarAcao={carregar} carregarAtendimentoAcao={carregarAtendimentoAcao} />))
  await clicar('Ver empresas')
}

function botao(texto: string) {
  return [...document.querySelectorAll('button')].find(b => b.textContent === texto && !b.closest('[hidden]'))!
}

async function clicar(texto: string) {
  await act(async () => { const b = botao(texto); b.focus(); b.click() })
}

function corpo() { return document.querySelector<HTMLElement>('[data-painel-corpo]')! }
function titulo() { return document.querySelector('[data-painel-lateral] header h2')?.textContent }

test.each([
  ['atendimento', 'Continuar atendimento', null],
  ['a_contatar', 'Iniciar atendimento', m.iniciar],
  ['sem_interesse', 'Retomar atendimento', m.retomar],
] as const)('%s abre o mesmo editor e recupera o resultado atualizado, a posição e a ação atual', async (situacao, acao, comando) => {
  comando?.mockResolvedValueOnce(confirmacao)
  const carregar = vi.fn().mockResolvedValueOnce(resultados({ ...empresa, situacao, versao: 1 })).mockResolvedValueOnce(resultados(empresa))
  const lerAtendimento = vi.fn().mockResolvedValue({ ok: true, dados })
  await montar(carregar, lerAtendimento)
  corpo().scrollTop = 245
  await clicar(acao)
  expect(titulo()).toBe('Loja Aurora')
  expect(corpo().querySelector('textarea[name="nota"]')).not.toBeNull()
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(m.push).not.toHaveBeenCalled()
  if (comando) expect(comando).toHaveBeenCalledOnce()
  else { expect(m.iniciar).not.toHaveBeenCalled(); expect(m.retomar).not.toHaveBeenCalled() }

  await clicar('Fechar')
  expect(titulo()).toBe('Lojas SP')
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(corpo().scrollTop).toBe(245)
  expect(document.activeElement).toBe(botao('Continuar atendimento'))
  expect(m.back).not.toHaveBeenCalled()
  expect(carregar).toHaveBeenCalledTimes(2)
})

test('falha ao abrir permite repetir apenas a leitura e falha ao voltar conserva os resultados', async () => {
  m.iniciar.mockResolvedValueOnce(confirmacao)
  const carregar = vi.fn().mockResolvedValueOnce(resultados({ ...empresa, situacao: 'a_contatar', versao: 1 }))
    .mockRejectedValueOnce(new Error('leitura')).mockResolvedValueOnce(resultados(empresa))
  const lerAtendimento = vi.fn().mockRejectedValueOnce(new Error('leitura')).mockResolvedValueOnce({ ok: true, dados })
  await montar(carregar, lerAtendimento)
  corpo().scrollTop = 180
  await clicar('Iniciar atendimento')
  expect(corpo().querySelector('[role="alert"]')).not.toBeNull()
  await clicar('Tentar novamente')
  expect(titulo()).toBe('Loja Aurora')
  expect(m.iniciar).toHaveBeenCalledOnce()
  await clicar('Fechar')
  expect(titulo()).toBe('Lojas SP')
  expect(corpo().textContent).toContain('Loja Aurora')
  expect(corpo().scrollTop).toBe(180)
  await clicar('Tentar novamente')
  expect(botao('Continuar atendimento')).toBeDefined()
  expect(m.iniciar).toHaveBeenCalledOnce()
})

test('resultados imediatos seguem abrindo a página de atendimento', async () => {
  await montar(vi.fn().mockResolvedValue(resultados(empresa)))
  await clicar('Continuar atendimento')
  expect(m.push).toHaveBeenCalledExactlyOnceWith('/fila/atendimento/empresa?origem=banco&pagina=1')
})

test('enquanto confirma o início, outro comando do painel não disputa a seleção', async () => {
  let confirmar!: (resultado: typeof confirmacao) => void
  m.iniciar.mockImplementationOnce(() => new Promise(resolve => { confirmar = resolve }))
  const carregar = vi.fn().mockResolvedValueOnce(resultados({ ...empresa, situacao: 'a_contatar', versao: 1 })).mockResolvedValueOnce(resultados(empresa))
  const lerAtendimento = vi.fn().mockResolvedValue({ ok: true, dados })
  await montar(carregar, lerAtendimento)
  corpo().scrollTop = 195
  await clicar('Iniciar atendimento')
  expect(botao('Ver empresa').disabled).toBe(true)
  expect(botao('Concluir inclusão').disabled).toBe(true)
  expect(botao('Fechar').disabled).toBe(true)
  corpo().scrollTop = 470
  await act(async () => confirmar(confirmacao))
  expect(titulo()).toBe('Loja Aurora')
  expect(m.iniciar).toHaveBeenCalledOnce()
  await clicar('Fechar')
  expect(corpo().scrollTop).toBe(195)
})

test('uma inclusão em andamento mantém seu formulário até chegar o recibo', async () => {
  let incluir!: (r: unknown) => void
  m.incluir.mockImplementationOnce(() => new Promise(resolve => { incluir = resolve }))
  const lerAtendimento = vi.fn().mockResolvedValue({ ok: true, dados })
  await montar(vi.fn().mockResolvedValue(resultados(empresa)), lerAtendimento)
  await act(async () => corpo().querySelector('form')!.requestSubmit())
  expect(botao('Continuar atendimento').disabled).toBe(true)
  expect(botao('Fechar').disabled).toBe(true)
  await clicar('Continuar atendimento')
  expect(lerAtendimento).not.toHaveBeenCalled()
  await act(async () => incluir({ erro: null, grupoId: 'grupo', inseridas: 1, vinculadas: 2, concluido: true }))
  expect(corpo().textContent).toContain('A lista reúne 2 empresas.')
  expect(botao('Continuar atendimento').disabled).toBe(false)
})

test('sair da aba durante um comando não navega quando a confirmação antiga chega', async () => {
  let confirmar!: (resultado: unknown) => void
  m.iniciar.mockImplementationOnce(() => new Promise(resolve => { confirmar = resolve }))
  const carregar = vi.fn().mockResolvedValue(resultados({ ...empresa, situacao: 'a_contatar', versao: 1 }))
  const lerAtendimento = vi.fn()
  await montar(carregar, lerAtendimento)
  await clicar('Iniciar atendimento')
  await act(async () => root.render(null))
  await montar(carregar, lerAtendimento)
  await act(async () => confirmar({ ...confirmacao, leituraDestino: { ok: true, destino: { tipo: 'funil', negociacaoId: 'N' } } }))
  expect(titulo()).toBe('Lojas SP')
  expect(m.push).not.toHaveBeenCalled()
  expect(sessionStorage.getItem('crm:acao-empresa:v1:empresa')).toBeNull()
})

test('contato confirmado na mesma lateral atualiza a linha do tempo e mantém o recibo', async () => {
  const atualizar = { ...dados, empresa: { ...empresa, versao: 3 }, contatos: [{ id: 'contato', tipo: 'nao_liguei',
    nota: 'Contato visível na linha do tempo', criadoEm: new Date(), proximoPasso: null, proximoPassoData: null, autor: 'Vendedor' }] }
  const lerAtendimento = vi.fn().mockResolvedValueOnce({ ok: true, dados }).mockRejectedValueOnce(new Error('leitura'))
    .mockResolvedValueOnce({ ok: true, dados: atualizar })
  m.registrar.mockResolvedValueOnce({ ok: true, erro: null, repetida: false, leituraDestino: { ok: true, destino: { tipo: 'permanecer' } } })
  m.preparar.mockResolvedValueOnce({ ok: true, empresa: atualizar.empresa, fase: 'inicial' })
  await montar(vi.fn().mockResolvedValue(resultados(empresa)), lerAtendimento)
  await clicar('Continuar atendimento')
  await act(async () => corpo().querySelector('form')!.requestSubmit())
  expect(corpo().textContent).toContain('Atendimento registrado.')
  await clicar('Tentar novamente')
  expect(corpo().textContent).toContain('Contato visível na linha do tempo')
  expect(corpo().textContent).toContain('Atendimento registrado.')
  expect(m.registrar).toHaveBeenCalledOnce()
})

test('dados cadastrais só podem abrir depois que a atualização dos resultados termina', async () => {
  let concluir!: (leitura: ReturnType<typeof resultados>) => void
  const carregar = vi.fn().mockResolvedValueOnce(resultados(empresa))
    .mockImplementationOnce(() => new Promise(resolve => { concluir = resolve }))
  await montar(carregar, vi.fn().mockResolvedValue({ ok: true, dados }))
  await clicar('Continuar atendimento')
  await clicar('Fechar')
  expect(botao('Ver empresa').disabled).toBe(true)
  await act(async () => concluir(resultados(empresa)))
  expect(botao('Ver empresa').disabled).toBe(false)
})
