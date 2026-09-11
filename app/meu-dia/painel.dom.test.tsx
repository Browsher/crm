// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ResultadoAgendaHistorico } from './historico'
import type { LinhaMeuDia } from './painel'

vi.mock('./historico-acao', () => ({ historicoDaAgendaAcao: vi.fn() }))

const { historicoDaAgendaAcao } = await import('./historico-acao')
const { PainelMeuDia } = await import('./painel')

const acaoMock = historicoDaAgendaAcao as unknown as ReturnType<typeof vi.fn>

const aurora: LinhaMeuDia = {
  id: '11111111-1111-1111-1111-111111111111', cnpj: '11222333000181', razaoSocial: 'Aurora', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Ana', telefone: '11999999999', email: 'ana@aurora.com',
  cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: 'Ligar', proximoPassoData: '2026-09-10',
  situacaoRetorno: 'atrasado', vencido: true,
}
const boreal: LinhaMeuDia = {
  id: '22222222-2222-2222-2222-222222222222', cnpj: '22333444000162', razaoSocial: 'Boreal', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Beto', telefone: '11988888888', email: 'beto@boreal.com',
  cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: 'Enviar proposta', proximoPassoData: '2026-09-11',
  situacaoRetorno: 'hoje', vencido: false,
}
const FILTROS = { nome: '', retorno: '' as const }

let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => {
  if (raiz) await act(async () => raiz?.unmount())
  host?.remove()
  raiz = null
  host = null
  acaoMock.mockReset()
})

async function montar(linhas: LinhaMeuDia[]) {
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  await act(async () => raiz?.render(<PainelMeuDia linhas={linhas} filtros={FILTROS} />))
  return host
}

function pendente() {
  let resolver!: (r: ResultadoAgendaHistorico) => void
  const promessa = new Promise<ResultadoAgendaHistorico>(resolve => { resolver = resolve })
  return { promessa, resolver }
}

function clicar(tela: HTMLDivElement, nome: string) {
  const botao = [...tela.querySelectorAll('button')].find(b => b.textContent?.includes(nome))
  return act(async () => botao?.click())
}

describe('PainelMeuDia no navegador', () => {
  test('durante o carregamento nenhum histórico de outro cliente fica na tela', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])
    await act(async () => { p1.resolver({ ok: true, contatos: [{ id:'c1', tipo:'ligacao', nota:'Nota da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-01T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota da Aurora')

    const p2 = pendente()
    acaoMock.mockReturnValueOnce(p2.promessa)
    await clicar(tela, 'Boreal')
    expect(tela.textContent).toContain('Carregando histórico')
    expect(tela.textContent).not.toContain('Nota da Aurora')
  })

  test('resposta antiga é descartada quando a seleção muda', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])

    const p2 = pendente()
    acaoMock.mockReturnValueOnce(p2.promessa)
    await clicar(tela, 'Boreal')
    await act(async () => { p2.resolver({ ok: true, contatos: [{ id:'c2', tipo:'ligacao', nota:'Nota da Boreal', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-02T10:00:00Z'), autor:'Beto' }] }) })
    expect(tela.textContent).toContain('Nota da Boreal')

    await act(async () => { p1.resolver({ ok: true, contatos: [{ id:'c1', tipo:'ligacao', nota:'Nota da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-01T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota da Boreal')
    expect(tela.textContent).not.toContain('Nota da Aurora')
  })

  // Nota sobre este teste: desde o React 18, chamar o `setState` de um
  // componente já desmontado por `createRoot().unmount()` não lança e não
  // atualiza nada, com ou sem o guarda (`pedido.current`) em `painel.tsx`.
  // Verificado por mutação: removendo o guarda do `.then`, do `.catch` e
  // até a checagem de `atualId` no início do efeito, o comportamento deste
  // teste específico não muda em nenhum dos casos. As asserções abaixo (sem
  // erro novo no console, DOM permanece vazio) são cinto e suspensório contra
  // regressão futura do runtime, não prova de que o guarda existe: quem
  // prova isso de verdade é 'resposta antiga é descartada quando a seleção
  // muda' e sua irmã de rejeição, logo abaixo, onde o componente CONTINUA
  // montado e a resposta velha teria efeito visível se o guarda sumisse.
  test('desmontar cancela o pedido: resolver depois não lança nem atualiza o DOM', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora])
    await act(async () => raiz?.unmount())
    raiz = null
    await act(async () => { p1.resolver({ ok: true, contatos: [{ id:'c1', tipo:'ligacao', nota:'Nota da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-01T10:00:00Z'), autor:'Ana' }] }) })
    const inesperados = erro.mock.calls.filter(([mensagem]) =>
      typeof mensagem !== 'string' || !mensagem.includes('not configured to support act'))
    expect(inesperados).toEqual([])
    expect(tela.innerHTML).toBe('')
    erro.mockRestore()
  })

  test('lista que esvazia não deixa perfil nem histórico antigos', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora])
    await act(async () => { p1.resolver({ ok: true, contatos: [{ id:'c1', tipo:'ligacao', nota:'Nota da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-01T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota da Aurora')

    await act(async () => raiz?.render(<PainelMeuDia linhas={[]} filtros={FILTROS} />))
    expect(tela.textContent).not.toContain('Nota da Aurora')
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.textContent).toContain('Nenhum retorno pendente para hoje')
  })

  test('posse negada limpa o perfil e avisa', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora])
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })
    const alerta = tela.querySelector('[role="alert"]')
    expect(alerta).not.toBeNull()
    expect(alerta?.textContent ?? '').toContain('não está mais na sua carteira')
    // A empresa ainda pode aparecer na lista da agenda (não revalidada), mas o
    // perfil não deve carregar dado nenhum dela: nem nome, nem contato.
    expect(alerta?.textContent ?? '').not.toContain('Ana')
    expect(alerta?.textContent ?? '').not.toContain('ana@aurora.com')
    expect(tela.querySelector('dl')).toBeNull()
    expect(tela.querySelector('a[href="/meu-dia"]')).not.toBeNull()
  })

  test('falha de carregamento não vira histórico vazio', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora])
    await act(async () => { p1.resolver({ ok: false, motivo: 'falha' }) })
    expect(tela.querySelector('[role="alert"]')).not.toBeNull()
    expect(tela.textContent).not.toContain('Ainda não há uma conversa registrada')
  })

  // `historicoDaAgendaAcao` não rejeita na prática (ela resolve com
  // `{ ok: false, motivo: 'falha' }`), mas o `.catch` do efeito é defesa
  // contra rejeição de verdade (erro inesperado na promise). Este teste
  // prova que essa defesa também descarta pedido velho: sem o guarda do
  // `.catch`, a rejeição da Aurora (antiga) sobrescreve `historico` com o id
  // dela, o que desalinha com a seleção corrente (Boreal) e troca a nota já
  // exibida por "Carregando histórico".
  test('rejeição de pedido antigo é descartada quando a seleção muda', async () => {
    let rejeitarAurora!: (motivo: unknown) => void
    const p1 = new Promise<ResultadoAgendaHistorico>((_resolve, reject) => { rejeitarAurora = reject })
    acaoMock.mockReturnValueOnce(p1)
    const tela = await montar([aurora, boreal])

    const p2 = pendente()
    acaoMock.mockReturnValueOnce(p2.promessa)
    await clicar(tela, 'Boreal')
    await act(async () => { p2.resolver({ ok: true, contatos: [{ id:'c2', tipo:'ligacao', nota:'Nota da Boreal', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-02T10:00:00Z'), autor:'Beto' }] }) })
    expect(tela.textContent).toContain('Nota da Boreal')

    await act(async () => { rejeitarAurora(new Error('falha de rede')) })
    expect(tela.textContent).toContain('Nota da Boreal')
  })
})
