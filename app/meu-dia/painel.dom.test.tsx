// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { detalhesSnapshot } from '@/src/lib/empresa-visual'
import { persistirComandoVenda } from '@/src/lib/venda-envio'
import { PainelMeuDia, type LinhaMeuDia } from './painel'
import { FiltrosForm } from './filtros-form'
import type { FiltrosMeuDia } from './agenda'
import { historicoDaAgendaAcao } from './historico-acao'
import { prepararContatoAcao, registrarContatoAcao } from '@/src/features/contato/acao'
import { detalheAcao, semInteresseAcao, telefoneAcao } from '../funil/acoes'
import { transmitirVenda } from '../venda-envio'
const navegar = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navegar }))
vi.mock('./historico-acao', () => ({ historicoDaAgendaAcao: vi.fn() }))
vi.mock('../funil/acoes', () => ({ detalheAcao: vi.fn(), telefoneAcao: vi.fn(), etapaAcao: vi.fn(), semInteresseAcao: vi.fn() }))
vi.mock('../venda-envio', () => ({ transmitirVenda: vi.fn() }))
vi.mock('@/app/empresas/busca/detalhe-acao', () => ({ lerDetalhesEmpresaAcao: vi.fn().mockResolvedValue({ ok: false }) }))
vi.mock('@/src/features/contato/acao', () => ({ prepararContatoAcao: vi.fn(), registrarContatoAcao: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const filtros = { nome: '', retorno: '' as const, periodo: '' as const }
const empresa = (id: string, nome: string): LinhaMeuDia => ({
  id, cnpj: null, razaoSocial: nome, nomeFantasia: null, cnaePrincipal: null,
  ultimoContato: null, contatoNome: null, telefone: null, email: null, cep: null, endereco: null,
  situacao: 'primeiro_contato', versao: 3, reservadoAte: null, posse: true,
  proximoPasso: 'Ligar', proximoPassoData: '2026-11-06', situacaoRetorno: 'futuro', vencido: false,
  empresa: { ...detalhesSnapshot({ razao_social: nome }, { tipo: 'cadastro', empresaId: id }), id, nome, situacao: 'primeiro_contato', versao: 3, negociacaoId: 'n-' + id },
})
const a = empresa('a', 'Aurora'), b = empresa('b', 'Boreal')
const detalhe = { id: 'n-a', empresaId: 'a', nome: 'Aurora', cidade: null, uf: null, cnpj: null, etapa: 'primeiro_contato' as const, empresa: a.empresa!, versao: 3, proximoPasso: 'Ligar', retorno: '2026-11-06', historico: [] }
let root: ReturnType<typeof createRoot>, host: HTMLDivElement
beforeEach(() => {
  vi.mocked(historicoDaAgendaAcao).mockResolvedValue({ ok: true, contatos: [] })
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  sessionStorage.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
async function montar(linhas = [a, b]) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await renderizar(linhas)
}
async function renderizar(linhas: LinhaMeuDia[], f: FiltrosMeuDia = filtros) {
  await act(async () => root.render(<><FiltrosForm filtros={f} /><PainelMeuDia usuarioId="u" linhas={linhas} agenda={linhas} filtros={f} /></>))
}
async function clicar(nome: string, base: ParentNode = host) {
  const botao = [...base.querySelectorAll('button')].find(e => e.textContent === nome)
  expect(botao, nome).toBeTruthy()
  await act(async () => { botao!.focus(); botao!.click() })
  return botao!
}
async function abrir(nome: string, acao = 'Abrir retorno') {
  const card = [...host.querySelectorAll('li')].find(e => e.textContent?.includes(nome))!
  return clicar(acao, card)
}
function pendente() {
  let resolver!: (r: Awaited<ReturnType<typeof historicoDaAgendaAcao>>) => void
  let rejeitar!: (erro: Error) => void
  const promessa = new Promise<Awaited<ReturnType<typeof historicoDaAgendaAcao>>>((resolve, reject) => { resolver = resolve; rejeitar = reject })
  return { promessa, resolver, rejeitar }
}
const contatos = (nota: string) => ({ ok: true as const, contatos: [{ id: nota, tipo: 'ligacao', nota, autor: 'Ana', criadoEm: new Date('2026-11-05T12:00:00Z'), proximoPasso: null, proximoPassoData: null }] })
async function expandir() { await clicar('Expandir todos') }

test('inicia sem seleção, sem histórico e com dois botões iguais por card', async () => {
  await montar()
  expect(historicoDaAgendaAcao).not.toHaveBeenCalled()
  expect(host.querySelector('aside')).toBeNull()
  const cards = host.querySelectorAll('[data-testid=lista-meu-dia] li')
  expect(cards).toHaveLength(2)
  for (const card of cards) expect([...card.querySelectorAll('button')].map(x => x.textContent)).toEqual(['Dados da empresa', 'Abrir retorno'])
})
test('abrir e fechar preserva rota e devolve foco ao gatilho', async () => {
  await montar()
  const url = location.href
  const gatilho = await abrir('Boreal')
  expect(historicoDaAgendaAcao).toHaveBeenCalledWith('b')
  expect(host.querySelector('aside')?.textContent).toContain('Boreal')
  for (const aba of host.querySelectorAll('[role=tab]')) expect(document.getElementById(aba.getAttribute('aria-controls')!)).not.toBeNull()
  await clicar('Fechar')
  expect(host.querySelector('aside')).toBeNull()
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(gatilho)
  expect(location.href).toBe(url)
})
test('histórico, dados e negociação voltam ao contexto exato no cabeçalho', async () => {
  await montar()
  await abrir('Aurora')
  await clicar('Histórico')
  await clicar('Dados da empresa', host.querySelector('aside')!)
  await clicar('Voltar')
  expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Histórico')
  await clicar('Negociação')
  expect(host.querySelector('aside')?.textContent).toContain('Registrar venda')
  await clicar('Voltar')
  expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Histórico')
  await clicar('Voltar')
  expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Próximo passo')
  expect(host.querySelector('aside')?.textContent).not.toContain('Registrar atendimento')
  expect(host.textContent).not.toContain('Voltar ao retorno')
})
test('A → B → A descarta respostas e rejeições antigas, sem cache ao reabrir', async () => {
  const p1 = pendente(), p2 = pendente(), p3 = pendente()
  vi.mocked(historicoDaAgendaAcao).mockReturnValueOnce(p1.promessa).mockReturnValueOnce(p2.promessa).mockReturnValueOnce(p3.promessa)
  await montar(); await abrir('Aurora'); await abrir('Boreal'); await abrir('Aurora'); await clicar('Histórico')
  await act(async () => p1.resolver(contatos('VELHA')))
  await act(async () => p2.rejeitar(Error('antiga')))
  expect(host.textContent).not.toContain('VELHA')
  expect(host.textContent).toContain('Carregando histórico')
  await act(async () => p3.resolver(contatos('ATUAL')))
  await expandir()
  expect(host.textContent).toContain('ATUAL')
  await clicar('Voltar'); await clicar('Fechar')
  const p4 = pendente()
  vi.mocked(historicoDaAgendaAcao).mockReturnValueOnce(p4.promessa)
  await abrir('Aurora'); await clicar('Histórico')
  expect(host.textContent).not.toContain('ATUAL')
  expect(host.textContent).toContain('Carregando histórico')
})
test('falha tem retry explícito que usa leitura nova', async () => {
  vi.mocked(historicoDaAgendaAcao).mockRejectedValueOnce(Error('rede')).mockResolvedValueOnce(contatos('RECUPERADA'))
  await montar(); await abrir('Aurora'); await clicar('Histórico')
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Não foi possível')
  await clicar('Tentar novamente'); await expandir()
  expect(host.textContent).toContain('RECUPERADA')
})
test('posse negada reconcilia contagens e props atrasadas não reintroduzem empresa', async () => {
  vi.mocked(historicoDaAgendaAcao).mockResolvedValueOnce({ ok: false, motivo: 'fora_da_carteira' })
  await montar(); await abrir('Aurora')
  expect(host.textContent).not.toContain('Aurora')
  expect(host.textContent).toContain('1 de 1 retorno')
  expect(document.activeElement?.getAttribute('role')).toBe('alert')
  await renderizar([b]); await renderizar([a, b])
  expect(host.querySelector('[data-testid=lista-meu-dia]')?.textContent).not.toContain('Aurora')
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
})
test('remoção e reaparição por revalidação e mudança de filtro nunca reabrem seleção', async () => {
  await montar(); await abrir('Aurora'); await renderizar([b]); await renderizar([a, b])
  expect(host.querySelector('aside')).toBeNull()
  await abrir('Boreal')
  await renderizar([a, b], { ...filtros, nome: 'B' })
  expect(host.querySelector('aside')).toBeNull()
})
test('cliente e tentativa sem negociação conservam ficha e filtros', async () => {
  const linhas = [ { ...a, situacao: 'cliente' as const }, { ...b, empresa: { ...b.empresa!, negociacaoId: null } } ]
  await montar(linhas)
  await renderizar(linhas, { nome: 'Ação', retorno: 'proximos', periodo: 'semana_que_vem' })
  await abrir('Aurora')
  expect(host.querySelector('aside a')?.getAttribute('href')).toBe('/carteira/a?de=meu-dia&nome=A%C3%A7%C3%A3o&retorno=proximos&periodo=semana_que_vem')
  expect(host.querySelector('aside a')?.textContent).toBe('Atendimento')
  await abrir('Boreal')
  expect(host.querySelector('aside a')?.getAttribute('href')).toBe('/carteira/b?de=meu-dia&nome=A%C3%A7%C3%A3o&retorno=proximos&periodo=semana_que_vem')
  expect(detalheAcao).not.toHaveBeenCalled()
})
test('envios salvos de venda e arquivo ficam explícitos mesmo com agenda vazia, sem seleção', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'v-original', alvo: { tipo: 'primeira', negociacaoId: 'n-fora' }, entrada: { valor: '20', data: '2026-11-05', observacao: 'original' } })
  sessionStorage.setItem('crm:funil:arquivo:v1:u', JSON.stringify({ linha: detalhe, chave: 'a-original' }))
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, atual: true, repetida: true })
  await montar([])
  expect(host.querySelector('aside')).toBeNull()
  expect(historicoDaAgendaAcao).not.toHaveBeenCalled()
  await clicar('Confirmar venda anterior')
  expect(vi.mocked(transmitirVenda).mock.calls[0][1].chave).toBe('v-original')
  await clicar('Confirmar arquivamento anterior')
  expect(vi.mocked(semInteresseAcao).mock.calls[0][0].get('chave')).toBe('a-original')
  expect(host.querySelector('aside')).toBeNull()
})
test('submit de filtro com venda suja pede descarte e permite continuar editando', async () => {
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Registrar venda')
  const input = host.querySelector('aside input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '25,00')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações')
  expect(navegar.push).not.toHaveBeenCalled()
  await clicar('Continuar editando', document)
  expect((host.querySelector('aside input') as HTMLInputElement).value).toBe('25,00')
  expect(host.querySelector('aside')?.textContent).toContain('Registrar primeira venda')
})
test('filtros em botões e subperíodos preservam semântica no submit', async () => {
  await montar()
  expect(host.querySelector('select[name=retorno]')).toBeNull()
  for (const nome of ['Todos', 'Atrasos', 'Hoje', 'Próximos']) expect([...host.querySelectorAll('button')].some(b => b.textContent === nome)).toBe(true)
  await clicar('Próximos')
  expect(navegar.push).toHaveBeenCalledWith('/meu-dia?retorno=proximos')
})

test('Dados pelo grid não busca histórico e fechar retoma seu botão', async () => {
  await montar()
  const gatilho = await abrir('Aurora', 'Dados da empresa')
  expect(historicoDaAgendaAcao).not.toHaveBeenCalled()
  await clicar('Fechar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(gatilho)
})
test('Dados aberto no retorno devolve foco ao gatilho reconstruído e à aba anterior', async () => {
  await montar(); await abrir('Aurora'); await clicar('Histórico')
  await clicar('Dados da empresa', host.querySelector('aside')!)
  await clicar('Voltar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement?.textContent).toBe('Dados da empresa')
  expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Histórico')
})
test('recuperação de venda de outra empresa não fecha a negociação aberta', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'outra', alvo: { tipo: 'primeira', negociacaoId: 'n-fora' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  await montar(); await abrir('Aurora'); await clicar('Negociação')
  await clicar('Confirmar venda anterior', host.querySelector('section[aria-label="Envios anteriores"]')!)
  expect(host.querySelector('aside')?.textContent).toContain('Aurora')
  expect(host.querySelector('aside')?.textContent).toContain('Registrar venda')
})
test('recuperação de arquivo pendente protege submit e links mesmo sem editor', async () => {
  sessionStorage.setItem('crm:funil:arquivo:v1:u', JSON.stringify({ linha: detalhe, chave: 'pendente' }))
  let resolver!: (r: Awaited<ReturnType<typeof semInteresseAcao>>) => void
  vi.mocked(semInteresseAcao).mockReturnValue(new Promise(resolve => { resolver = resolve }))
  await montar()
  await clicar('Confirmar arquivamento anterior')
  const saida = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(saida)
  expect(saida.defaultPrevented).toBe(true)
  await act(async () => {
    history.replaceState({}, '', location.href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(typeof history.state?.__crmEdicaoAdministrativa).toBe('string')
  expect(document.querySelector('[role=dialog]')).toBeNull()
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(navegar.push).not.toHaveBeenCalled()
  await act(async () => resolver({ ok: true, atual: true, repetida: true }))
  expect(host.querySelector('aside')).toBeNull()
})
test('confirmação de arquivo usa detalhe autorizado e fecha só a seleção correspondente', async () => {
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, atual: true, repetida: false })
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Sem interesse')
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Confirmar Sem interesse')
  await clicar('Confirmar Sem interesse', document)
  expect(vi.mocked(semInteresseAcao).mock.calls[0][0].get('versao')).toBe('3')
  expect(host.querySelector('aside')).toBeNull()
  expect(host.querySelector('[data-testid=lista-meu-dia]')?.textContent).not.toContain('Aurora')
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
})
test('resposta de histórico após remover e reabrir outra empresa não muda seleção', async () => {
  const antigo = pendente()
  vi.mocked(historicoDaAgendaAcao).mockReturnValueOnce(antigo.promessa)
  await montar(); await abrir('Aurora'); await renderizar([b]); await abrir('Boreal'); await clicar('Histórico')
  await act(async () => antigo.resolver({ ok: false, motivo: 'fora_da_carteira' }))
  expect(host.querySelector('aside')?.textContent).toContain('Boreal')
  expect(host.querySelector('[role=alert]')).toBeNull()
})

test('Enter da pesquisa mantém recorte e período atuais em vez do primeiro botão', async () => {
  const f = { nome: 'Ação', retorno: 'proximos' as const, periodo: 'amanha' as const }
  await montar()
  await renderizar([a, b], f)
  const form = host.querySelector('form')!
  const primeiroSubmit = form.querySelector<HTMLButtonElement>('button[type=submit]')!
  expect(primeiroSubmit.textContent).toBe('Filtrar')
  await act(async () => form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: primeiroSubmit })))
  expect(navegar.push).toHaveBeenCalledWith('/meu-dia?nome=A%C3%A7%C3%A3o&retorno=proximos&periodo=amanha')
})

test('rascunho real em Atendimento permanece protegido no Histórico e no submit de pesquisa', async () => {
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.mocked(prepararContatoAcao).mockResolvedValue({ ok: true, fase: 'negociacao', empresa: a.empresa! })
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento')
  const nota = host.querySelector('aside textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Rascunho real')
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clicar('Histórico')
  await act(async () => host.querySelector('form')!.requestSubmit())
  expect(navegar.push).not.toHaveBeenCalled()
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando', document)
  await clicar('Atendimento')
  expect((host.querySelector('aside textarea') as HTMLTextAreaElement).value).toBe('Rascunho real')
  await abrir('Boreal')
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  expect(host.querySelector('aside')?.textContent).toContain('Aurora')
  await clicar('Continuar editando', document)
})
test('contato pendente em aba inativa conserva comando e impede submit, Sem interesse e troca de empresa', async () => {
  const valor = { tipo: 'acompanhamento', nota: 'Envio desconhecido', proximoPasso: '', proximoPassoData: '' }
  const salvo = JSON.stringify({ valor, envio: { valor, chave: 'contato-original', versao: 2 } })
  sessionStorage.setItem('crm:contato:v1:a', salvo)
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Histórico')
  await act(async () => host.querySelector('form')!.requestSubmit())
  expect(navegar.push).not.toHaveBeenCalled()
  await clicar('Descartar', document)
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Confirme o envio anterior')
  expect(sessionStorage.getItem('crm:contato:v1:a')).toBe(salvo)
  expect(semInteresseAcao).not.toHaveBeenCalled()
})
test('venda confirmada fecha seleção após a sentinela sem abrir o próximo card', async () => {
  vi.spyOn(history, 'back').mockImplementation(() => {})
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Registrar venda')
  const inputs = host.querySelectorAll<HTMLInputElement>('aside input')
  for (const [indice, valor] of ['25,00', '2026-11-05'].entries()) await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(inputs[indice], valor)
    inputs[indice].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => host.querySelector<HTMLFormElement>('aside form')!.requestSubmit())
  await clicar('Confirmar venda', document)
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(host.querySelector('aside')).toBeNull()
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
  expect(navegar.refresh).toHaveBeenCalled()
})
test('teclado das abas e Escape mantêm o mapa de Voltar e Fechar', async () => {
  await montar(); await abrir('Aurora')
  const primeira = host.querySelector('[role=tab]')!
  await act(async () => primeira.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })))
  expect(document.activeElement?.textContent).toBe('Histórico')
  await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(host.querySelector('[role=tab][aria-selected=true]')?.textContent).toBe('Próximo passo')
  await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(host.querySelector('aside')).toBeNull()
})

test('replay explícito também respeita rascunho ativo quando comando chega de outro consumidor', async () => {
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.mocked(prepararContatoAcao).mockResolvedValue({ ok: true, fase: 'negociacao', empresa: a.empresa! })
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, atual: true, repetida: true })
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento')
  const nota = host.querySelector('aside textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Não descartar no replay')
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    sessionStorage.setItem('crm:funil:arquivo:v1:u', JSON.stringify({ linha: detalhe, chave: 'outro-consumidor' }))
    window.dispatchEvent(new Event('crm-funil-arquivo'))
  })
  await clicar('Confirmar arquivamento anterior')
  expect(semInteresseAcao).not.toHaveBeenCalled()
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando', document)
  expect((host.querySelector('aside textarea') as HTMLTextAreaElement).value).toBe('Não descartar no replay')
})

test('envio real em voo bloqueia filtro e troca de painel e preserva versão para replay', async () => {
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.mocked(prepararContatoAcao).mockResolvedValue({ ok: true, fase: 'negociacao', empresa: { ...a.empresa!, versao: 9 } })
  let resolver!: (r: Awaited<ReturnType<typeof registrarContatoAcao>>) => void
  vi.mocked(registrarContatoAcao).mockReturnValue(new Promise(resolve => { resolver = resolve }))
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento')
  const formulario = host.querySelector<HTMLFormElement>('aside form')!
  const nota = formulario.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Em voo')
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => formulario.requestSubmit())
  const salvo = sessionStorage.getItem('crm:contato:v1:a')
  expect(JSON.parse(salvo!).envio.versao).toBe(9)
  await act(async () => host.querySelector('form')!.requestSubmit())
  expect(navegar.push).not.toHaveBeenCalled()
  await abrir('Boreal', 'Dados da empresa')
  expect(host.querySelector('aside')?.textContent).toContain('Aurora')
  expect(document.querySelector('[role=dialog]')).toBeNull()
  await act(async () => resolver({ ok: false, erro: 'Sem confirmação', motivo: 'sem_permissao' }))
  expect(sessionStorage.getItem('crm:contato:v1:a')).toBe(salvo)
  expect(formulario.isConnected).toBe(true)
})

test('falha de replay exibe resultado desconhecido mesmo depois de aviso anterior de sucesso', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'venda', alvo: { tipo: 'recompra' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  sessionStorage.setItem('crm:funil:arquivo:v1:u', JSON.stringify({ linha: detalhe, chave: 'arquivo' }))
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  vi.mocked(semInteresseAcao).mockRejectedValueOnce(Error('resposta perdida'))
  await montar([])
  await clicar('Confirmar venda anterior')
  await clicar('Confirmar arquivamento anterior')
  expect(host.textContent).toContain('Não foi possível confirmar o resultado')
  expect(sessionStorage.getItem('crm:funil:arquivo:v1:u')).toContain('arquivo')
})

test('replay de venda fecha o retorno correspondente sem escolher outro card', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'a', chave: 'correspondente', alvo: { tipo: 'primeira', negociacaoId: 'n-a' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  await montar()
  await abrir('Aurora')
  await clicar('Confirmar venda anterior')
  expect(host.querySelector('aside')).toBeNull()
  expect(host.textContent).toContain('Nenhum retorno selecionado')
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
})
