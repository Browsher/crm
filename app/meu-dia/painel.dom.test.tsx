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
const navegar = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
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
  if (root) await act(async () => {
    root.unmount()
    // A retirada nativa do histórico e seu callback de foco são assíncronos.
    // Deixar o frame concluir antes de montar o dono do teste seguinte.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
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
  const botao = [...base.querySelectorAll('button')].find(e => e.textContent === nome && !e.closest('[hidden]'))
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
  expect(host.querySelector('[role=tablist]')).toBeNull()
  expect(host.querySelector('aside nav')?.textContent).toContain('Histórico')
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toBe('Negociação')
  await clicar('Fechar')
  expect(host.querySelector('aside')).toBeNull()
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(gatilho)
  expect(location.href).toBe(url)
})
test('menu troca seção sem perder o contexto', async () => {
  await montar()
  expect(host.querySelector('[data-painel-lateral]')).toBeNull()
  await abrir('Aurora')
  expect(host.querySelector('[role="tablist"]')).toBeNull()
  expect(host.querySelector('aside')?.textContent).toContain('Próximo passo')
  await clicar('Histórico')
  expect(host.querySelector('[data-painel-lateral] button')?.textContent).toBe('Voltar')
  expect(host.querySelector('aside nav')).toBeNull()
  await clicar('Negociação')
  expect(host.querySelector('aside nav')?.textContent).toContain('Atendimento e próximo passo')
  await clicar('Voltar')
  expect(host.querySelector('aside h3')?.textContent).toBe('Histórico')
  await clicar('Voltar')
  await clicar('Dados da empresa', host.querySelector('aside')!)
  await clicar('Voltar')
  expect(host.querySelector('aside nav')).not.toBeNull()
  expect(host.querySelector('aside')?.textContent).toContain('Próximo passo')
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
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toContain('Tentar novamente')
  await clicar('Tentar novamente'); await expandir()
  expect(host.textContent).toContain('RECUPERADA')
})

test('filtro sem resultados conserva controles e eventos e Ver todos limpa sem nova consulta', async () => {
  vi.mocked(historicoDaAgendaAcao).mockResolvedValueOnce(contatos('CONTATO AUTORIZADO'))
  await montar(); await abrir('Aurora'); await clicar('Histórico')
  const vendas = [...host.querySelectorAll<HTMLButtonElement>('aside button')].find(b => b.textContent?.startsWith('Vendas'))!
  await act(async () => vendas.click())
  expect(host.querySelector('aside [aria-label="Filtrar eventos"]')).not.toBeNull()
  expect(host.querySelector('aside details')).toBeNull()
  expect(host.querySelector('aside [role=status]')?.textContent).toContain('Nenhum registro neste filtro')
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toBe('Ver todos')
  await clicar('Ver todos')
  expect(document.activeElement).toBe(host.querySelector('aside h3'))
  await expandir()
  expect(host.querySelector('aside')?.textContent).toContain('CONTATO AUTORIZADO')
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toBe('Negociação')
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
  expect(host.querySelector('aside')?.textContent).not.toContain('Venda registrada')
})

test('histórico realmente vazio orienta primeiro registro sem criar ação no corpo', async () => {
  await montar(); await abrir('Aurora'); await clicar('Histórico')
  const corpo = host.querySelector('[data-painel-corpo]')!
  expect(corpo.textContent).toContain('Nenhum contato registrado')
  expect(corpo.querySelector('button, a')).toBeNull()
  expect(host.querySelector('[data-painel-rodape]')?.textContent).toBe('Negociação')
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
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Registrar venda')
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

test('Dados pelo grid não busca histórico e Voltar retoma seu botão', async () => {
  await montar()
  const gatilho = await abrir('Aurora', 'Dados da empresa')
  expect(historicoDaAgendaAcao).not.toHaveBeenCalled()
  await clicar('Voltar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement).toBe(gatilho)
})
test('Dados pelo menu após Voltar devolve foco ao gatilho reconstruído e à origem real', async () => {
  await montar(); await abrir('Aurora'); await clicar('Histórico'); await clicar('Voltar')
  await clicar('Dados da empresa', host.querySelector('aside')!)
  await clicar('Voltar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(document.activeElement?.textContent).toBe('Dados da empresa')
  expect(host.querySelector('aside nav')).not.toBeNull()
})
test('recuperação de venda de outra empresa não fecha a negociação aberta', async () => {
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'outra', alvo: { tipo: 'primeira', negociacaoId: 'n-fora' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  await montar(); await abrir('Aurora'); await clicar('Negociação')
  await clicar('Confirmar venda anterior', host.querySelector('section[aria-label="Envios anteriores"]')!)
  // O replay termina retirando a sentinela da negociação.
  // Concluir seu popstate aqui, antes de desmontar o dono e iniciar outro teste.
  expect(voltar).toHaveBeenCalled()
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(host.querySelector('aside')?.textContent).toContain('Aurora')
  expect(host.querySelector('aside nav')?.textContent).toContain('Atendimento e próximo passo')
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
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Sem interesse')
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
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
  const nota = host.querySelector('aside textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(nota, 'Rascunho real')
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await clicar('Voltar'); await clicar('Fechar mantendo rascunho', document)
  await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  await clicar('Voltar'); await clicar('Histórico')
  await act(async () => host.querySelector('form')!.requestSubmit())
  expect(navegar.push).not.toHaveBeenCalled()
  expect(document.querySelector('[role=dialog]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando', document)
  await clicar('Voltar'); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
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
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Registrar venda')
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
test('botões de seção e Escape mantêm o mapa de Voltar e Fechar sem protocolo de setas', async () => {
  await montar(); await abrir('Aurora')
  const historico = host.querySelector<HTMLButtonElement>('aside nav button:last-child')!
  historico.focus()
  const seta = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
  await act(async () => historico.dispatchEvent(seta))
  expect(seta.defaultPrevented).toBe(false)
  expect(document.activeElement).toBe(historico)
  await clicar('Histórico')
  expect(host.querySelector('aside h3')?.textContent).toBe('Histórico')
  expect(document.activeElement).toBe(host.querySelector('aside h3'))
  await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(host.querySelector('aside nav')).not.toBeNull()
  expect(document.activeElement?.id).toBe('meu-dia-historico-a')
  await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(host.querySelector('aside')).toBeNull()
})

test('replay explícito também respeita rascunho ativo quando comando chega de outro consumidor', async () => {
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.mocked(prepararContatoAcao).mockResolvedValue({ ok: true, fase: 'negociacao', empresa: a.empresa! })
  vi.mocked(semInteresseAcao).mockResolvedValue({ ok: true, atual: true, repetida: true })
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
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
  await montar(); await abrir('Aurora'); await clicar('Negociação'); await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
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

test('replay pelo editor de outra empresa preserva seleção e continua permitindo atendimento', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'a', chave: 'venda-editor-a', alvo: { tipo: 'primeira', negociacaoId: 'n-a' }, entrada: { valor: '20', data: '2026-11-05', observacao: 'original' } })
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true })
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, id: 'n-b', empresaId: 'b', nome: 'Boreal', empresa: b.empresa! })
  vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.mocked(prepararContatoAcao).mockResolvedValue({ ok: true, fase: 'negociacao', empresa: b.empresa! })
  await montar(); await abrir('Boreal'); await clicar('Negociação')
  await clicar('Verificar registro', host.querySelector('aside')!)
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(host.querySelector('aside')?.textContent).toContain('Boreal')
  expect(vi.mocked(transmitirVenda).mock.calls.at(-1)![1].empresaId).toBe('a')
  await clicar('Atendimento e próximo passo'); await clicar('Registrar atendimento')
  expect(host.querySelector('aside textarea')).not.toBeNull()
  await clicar('Voltar')
  // O primeiro Voltar sai da tarefa para sua leitura de origem.
  expect(host.querySelector('section:not([hidden]) h3')?.textContent).toBe('Atendimento e próximo passo')
  await clicar('Voltar')
  expect(host.querySelector('aside nav')).not.toBeNull()
})

test('replay compacto com editor limpo protege reload e Back pelas duas instâncias reais de venda', async () => {
  const comando = { usuarioId: 'u', empresaId: 'a', chave: 'externo-original', alvo: { tipo: 'primeira' as const, negociacaoId: 'n-a' }, entrada: { valor: '20', data: '2026-11-05', observacao: 'A' } }
  persistirComandoVenda(comando)
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, id: 'n-b', empresaId: 'b', nome: 'Boreal', empresa: b.empresa! })
  let resolver!: (r: Awaited<ReturnType<typeof transmitirVenda>>) => void
  vi.mocked(transmitirVenda).mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  await montar(); await abrir('Boreal'); await clicar('Negociação')
  const href = location.href
  await clicar('Confirmar venda anterior', host.querySelector('section[aria-label="Envios anteriores"]')!)
  try {
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)
    const sentinela = history.state?.__funilRascunho
    expect(typeof sentinela).toBe('string')
    await act(async () => {
      history.replaceState({}, '', href)
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
    })
    expect(history.state?.__funilRascunho).toBe(sentinela)
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(host.querySelector('aside')?.textContent).toContain('Boreal')
    expect(location.href).toBe(href)
    await act(async () => host.querySelector('form')!.requestSubmit())
    expect(navegar.push).not.toHaveBeenCalled()
  } finally {
    await act(async () => resolver({ ok: false, erro: 'Resposta perdida' }))
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  }
  expect(JSON.parse(sessionStorage.getItem('crm:venda:v1:u')!)).toEqual(comando)
  expect(host.querySelector('aside')?.textContent).toContain('Boreal')
})

test.each([
  { tela: 'retorno', aba: 'passo', acao: 'Fechar' },
  { tela: 'retorno', aba: 'passo', acao: 'Escape' },
  { tela: 'retorno', aba: 'passo', acao: 'Histórico' },
  { tela: 'retorno', aba: 'passo', acao: 'teclado' },
  { tela: 'retorno', aba: 'historico', acao: 'Voltar' },
  { tela: 'retorno', aba: 'historico', acao: 'Escape' },
  { tela: 'dados-grid', aba: 'passo', acao: 'Voltar' },
  { tela: 'dados-grid', aba: 'passo', acao: 'Escape' },
  { tela: 'dados-retorno', aba: 'passo', acao: 'Voltar' },
  { tela: 'dados-retorno', aba: 'passo', acao: 'Escape' },
])('replay pendente protege $acao em $tela/$aba e libera a mesma seleção depois', async ({ tela, aba, acao }) => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'guarda-interna', alvo: { tipo: 'recompra' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  let resolver!: (r: Awaited<ReturnType<typeof transmitirVenda>>) => void
  vi.mocked(transmitirVenda).mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  await montar()
  if (tela === 'dados-grid') await abrir('Aurora', 'Dados da empresa')
  else {
    await abrir('Aurora')
    if (aba === 'historico') await clicar('Histórico')
    if (tela === 'dados-retorno') await clicar('Dados da empresa', host.querySelector('aside')!)
  }
  const titulo = host.querySelector('aside h2')?.textContent
  await clicar('Confirmar venda anterior', host.querySelector('section[aria-label="Envios anteriores"]')!)
  try {
    if (acao === 'Escape') await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    else if (acao === 'teclado') {
      const foco = document.activeElement
      await act(async () => host.querySelector('aside nav button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })))
      expect(document.activeElement).toBe(foco)
    } else await clicar(acao, host.querySelector('aside')!)
    expect(host.querySelector('aside h2')?.textContent).toBe(titulo)
    if (tela === 'retorno') expect(!!host.querySelector('aside nav')).toBe(aba === 'passo')
    expect(document.querySelector('[role=dialog]')).toBeNull()
  } finally {
    await act(async () => resolver({ ok: false, erro: 'Ainda sem confirmação' }))
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  }
  expect(host.querySelector('aside h2')?.textContent).toBe(titulo)
  expect(JSON.parse(sessionStorage.getItem('crm:venda:v1:u')!).chave).toBe('guarda-interna')
  const cabecalho = host.querySelector('aside header')!
  await clicar(tela === 'retorno' && aba === 'passo' ? 'Fechar' : 'Voltar', cabecalho)
  if (tela === 'dados-grid' || tela === 'retorno' && aba === 'passo') expect(host.querySelector('aside')).toBeNull()
  else expect(host.querySelector('aside nav')).not.toBeNull()
})

test('guarda de recuperação não bloqueia o fechamento interno após confirmação de arquivo', async () => {
  sessionStorage.setItem('crm:funil:arquivo:v1:u', JSON.stringify({ linha: detalhe, chave: 'arquivo-confirmado' }))
  let resolver!: (r: Awaited<ReturnType<typeof semInteresseAcao>>) => void
  vi.mocked(semInteresseAcao).mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  await montar(); await abrir('Aurora')
  await clicar('Confirmar arquivamento anterior')
  try {
    await clicar('Fechar', host.querySelector('aside')!)
    expect(host.querySelector('aside h2')?.textContent).toBe('Aurora')
    await act(async () => host.querySelector('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(host.querySelector('aside h2')?.textContent).toBe('Aurora')
  } finally {
    await act(async () => resolver({ ok: true, atual: true, repetida: true }))
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  }
  expect(host.querySelector('aside')).toBeNull()
  expect(host.querySelector('[data-testid=lista-meu-dia]')?.textContent).not.toContain('Aurora')
  expect(host.textContent).toContain('Boreal')
  expect(historicoDaAgendaAcao).toHaveBeenCalledTimes(1)
})

test('primeira venda da negociação abre somente o destino autenticado, mesmo junto do texto de sucesso', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'a', chave: 'primeira-destino', alvo: { tipo: 'primeira', negociacaoId: 'n-a' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  vi.mocked(transmitirVenda).mockResolvedValue({ ok: true, leituraDestino: { ok: true, destino: { tipo: 'carteira', empresaId: 'destino-autorizado' } } })
  await montar(); await abrir('Aurora'); await clicar('Negociação')
  await clicar('Verificar registro', host.querySelector('aside')!)
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(navegar.replace).toHaveBeenCalledWith('/carteira/destino-autorizado?venda=registrada')
  expect(host.querySelector('aside')).toBeNull()
})


test.each(['card', 'historico'])('Dados pelo %s mantém negociação na lateral e restaura Dados, contexto e foco', async origem => {
  await montar()
  const card = await abrir('Aurora', origem === 'card' ? 'Dados da empresa' : 'Abrir retorno')
  if (origem === 'historico') {
    await clicar('Histórico')
    await clicar('Voltar')
    await clicar('Dados da empresa', host.querySelector('aside')!)
  }
  expect([...host.querySelectorAll('aside header button')].map(b => b.textContent)).toEqual(['Voltar'])
  const comercial = await clicar('Negociação', host.querySelector('aside footer')!)
  expect(host.querySelectorAll('aside')).toHaveLength(1)
  expect(host.querySelector('aside nav')?.textContent).toContain('Atendimento e próximo passo')
  await clicar('Voltar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(host.querySelector('aside h2')?.textContent).toBe('Dados da empresa')
  expect(document.activeElement?.id).toBe(comercial.id)
  await clicar('Voltar')
  await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  if (origem === 'card') {
    expect(host.querySelector('aside')).toBeNull()
    expect(document.activeElement).toBe(card)
  } else {
    expect(host.querySelector('aside nav')).not.toBeNull()
    expect(document.activeElement?.textContent).toBe('Dados da empresa')
  }
})

test.each(['cliente', 'tentativa'])('Dados de %s usa Atendimento autorizado com todos os filtros', async tipo => {
  const linha = { ...a, situacao: tipo === 'cliente' ? 'cliente' as const : a.situacao, empresa: { ...a.empresa!, negociacaoId: null } }
  await montar([linha])
  await renderizar([linha], { nome: 'Aurora', retorno: 'proximos', periodo: 'amanha' })
  await abrir('Aurora', 'Dados da empresa')
  const link = host.querySelector('aside footer a')
  expect(link?.textContent).toBe('Atendimento')
  expect(link?.getAttribute('href')).toBe('/carteira/a?de=meu-dia&nome=Aurora&retorno=proximos&periodo=amanha')
  expect(host.querySelector('aside footer')?.textContent).not.toContain('Negociação')
})


test('Atendimento em Dados passa pela guarda de links durante replay pendente', async () => {
  persistirComandoVenda({ usuarioId: 'u', empresaId: 'fora', chave: 'link-pendente', alvo: { tipo: 'recompra' }, entrada: { valor: '20', data: '2026-11-05', observacao: '' } })
  let resolver!: (r: Awaited<ReturnType<typeof transmitirVenda>>) => void
  vi.mocked(transmitirVenda).mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  await montar([{ ...a, situacao: 'cliente' }])
  await abrir('Aurora', 'Dados da empresa')
  const link = host.querySelector<HTMLAnchorElement>('aside footer a')!
  await clicar('Confirmar venda anterior', host.querySelector('section[aria-label="Envios anteriores"]')!)
  try {
    for (const detalheClique of [1, 0]) {
      const evento = new MouseEvent('click', { bubbles: true, cancelable: true, detail: detalheClique })
      await act(async () => link.dispatchEvent(evento))
      expect(evento.defaultPrevented).toBe(true)
      expect(host.querySelector('aside h2')?.textContent).toBe('Dados da empresa')
    }
    expect(JSON.parse(sessionStorage.getItem('crm:venda:v1:u')!).chave).toBe('link-pendente')
  } finally {
    await act(async () => resolver({ ok: false, erro: 'Sem confirmação' }))
  }
})
