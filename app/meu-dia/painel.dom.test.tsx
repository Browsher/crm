// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import type { ResultadoAgendaHistorico } from './historico'

vi.mock('./historico-acao', () => ({ historicoDaAgendaAcao: vi.fn() }))

const { historicoDaAgendaAcao } = await import('./historico-acao')
const { PainelMeuDia } = await import('./painel')

const acaoMock = historicoDaAgendaAcao as unknown as ReturnType<typeof vi.fn>

const aurora: EmpresaComigo = {
  id: '11111111-1111-1111-1111-111111111111', cnpj: '11222333000181', razaoSocial: 'Aurora', nomeFantasia: null,
  cnaePrincipal: null, ultimoContato: null, contatoNome: 'Ana', telefone: '11999999999', email: 'ana@aurora.com',
  cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: 'Ligar', proximoPassoData: '2026-09-10',
  situacaoRetorno: 'atrasado', vencido: true,
}
const boreal: EmpresaComigo = {
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

async function montar(linhas: EmpresaComigo[]) {
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

  test('desmontar cancela o pedido: resolver depois não chama setState', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    await montar([aurora])
    await act(async () => raiz?.unmount())
    raiz = null
    await expect(act(async () => { p1.resolver({ ok: true, contatos: [] }) })).resolves.not.toThrow()
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
})
