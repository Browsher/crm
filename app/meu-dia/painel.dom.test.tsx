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
// Preenchimento só para testar a contagem quando `agenda` (a lista completa,
// antes do filtro de nome/retorno) tem mais itens do que `linhas` (a lista
// já filtrada). Não aparecem em nenhum `linhas` de teste.
function preenchimento(indice: number): LinhaMeuDia {
  return {
    id: `99999999-9999-9999-9999-99999999999${indice}`, cnpj: '0', razaoSocial: `Fora do filtro ${indice}`, nomeFantasia: null,
    cnaePrincipal: null, ultimoContato: null, contatoNome: null, telefone: '1', email: null,
    cep: null, endereco: null, reservadoAte: null, posse: true, proximoPasso: null, proximoPassoData: null,
    situacaoRetorno: 'hoje', vencido: false,
  }
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

async function montar(linhas: LinhaMeuDia[], agenda = linhas) {
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  await act(async () => raiz?.render(<PainelMeuDia linhas={linhas} agenda={agenda} filtros={FILTROS} />))
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

    await act(async () => raiz?.render(<PainelMeuDia linhas={[]} agenda={[]} filtros={FILTROS} />))
    expect(tela.textContent).not.toContain('Nota da Aurora')
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.textContent).toContain('Nenhum retorno pendente para hoje')
  })

  // Mudança de comportamento pedida pelo usuário (revoga uma decisão de
  // rodada anterior): quando a posse é negada, a empresa sai da LISTA e não
  // só do perfil. O aviso continua aparecendo, no lugar do perfil, mas sem
  // selecionar outra empresa sozinho (isso disparia um pedido de histórico
  // que o usuário não pediu — por isso a asserção de `toHaveBeenCalledTimes(1)`
  // no fim, provando que nenhum novo pedido saiu depois da remoção).
  test('posse negada remove a empresa da lista e do perfil, sem selecionar outra', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal], [aurora, boreal, preenchimento(1), preenchimento(2), preenchimento(3)])
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })

    const alerta = tela.querySelector('[role="alert"]')
    expect(alerta).not.toBeNull()
    expect(alerta?.textContent ?? '').toContain('não está mais na sua carteira')
    expect(alerta?.textContent ?? '').not.toContain('Ana')
    expect(alerta?.textContent ?? '').not.toContain('ana@aurora.com')
    expect(tela.querySelector('dl')).toBeNull()
    expect(tela.querySelector('a[href="/meu-dia"]')).not.toBeNull()

    // saiu da lista de verdade, não só do perfil
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.textContent).toContain('Boreal')
    expect(tela.querySelectorAll('[data-testid="lista-meu-dia"] li').length).toBe(1)

    // a contagem (movida para o painel) reflete a lista sem a empresa
    // removida, nos dois números: "1 de 4 retornos" (era "2 de 5")
    expect(tela.textContent).toContain('1 de 4 retornos')

    // nenhuma seleção automática: só o pedido da Aurora foi feito
    expect(acaoMock).toHaveBeenCalledTimes(1)
  })

  test('lista esvazia por posse negada cai no vazio que já existe', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora])
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })
    expect(tela.textContent).toContain('Nenhum retorno pendente para hoje')
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.querySelector('[role="alert"]')).toBeNull()
  })

  test('remover empresa por posse negada preserva a rolagem dos itens restantes', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])
    const lista = tela.querySelector('[data-testid="lista-meu-dia"]') as HTMLUListElement
    lista.scrollTop = 42
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })
    // a remoção precisa ter acontecido de verdade, senão a preservação de
    // `scrollTop` abaixo seria vácua (nada mudou, então óbvio que não mudou)
    expect(tela.querySelectorAll('[data-testid="lista-meu-dia"] li').length).toBe(1)
    expect(tela.textContent).not.toContain('Aurora')
    const listaDepois = tela.querySelector('[data-testid="lista-meu-dia"]') as HTMLUListElement
    // mesmo nó do DOM (React reconcilia a `<li>` removida, não recria o `<ul>`)
    expect(listaDepois).toBe(lista)
    expect(listaDepois.scrollTop).toBe(42)
  })

  // Equivalente, para quem navega por teclado, da preservação de rolagem
  // acima: o botão da empresa removida sai do DOM. Sem cuidado, o foco cai
  // no `body` e quem usa teclado perde o lugar. O foco precisa ir para o
  // aviso que aparece no lugar do perfil.
  test('remover empresa por posse negada manda o foco para o aviso, não para o body', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])
    const botaoAurora = [...tela.querySelectorAll('button')].find(b => b.textContent?.includes('Aurora'))!
    botaoAurora.focus()
    expect(document.activeElement).toBe(botaoAurora)

    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })

    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement?.getAttribute('role')).toBe('alert')
    expect(document.activeElement?.textContent).toContain('não está mais na sua carteira')
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

  // O caso mais perigoso do componente: A -> B -> A de novo, com três
  // pedidos distintos em voo ao longo do caminho. A resposta do PRIMEIRO
  // pedido de A (que tem o MESMO empresaId da seleção corrente quando volta
  // a cair em A) precisa ser ignorada mesmo assim — só a identidade do
  // pedido (não o id da empresa) decide o que é válido.
  test('ida e volta A -> B -> A: primeira resposta de A não reaparece quando o novo pedido de A está no ar', async () => {
    const p1a = pendente() // primeiro pedido de Aurora
    acaoMock.mockReturnValueOnce(p1a.promessa)
    const tela = await montar([aurora, boreal])

    const pb = pendente() // pedido de Boreal
    acaoMock.mockReturnValueOnce(pb.promessa)
    await clicar(tela, 'Boreal')

    const p2a = pendente() // segundo (terceiro, contando o de Boreal) pedido, ao voltar para Aurora
    acaoMock.mockReturnValueOnce(p2a.promessa)
    await clicar(tela, 'Aurora')
    expect(tela.textContent).toContain('Carregando histórico')

    // a primeira resposta de Aurora chega tarde: mesmo empresaId da seleção
    // corrente, mas de um pedido diferente (identidade velha)
    await act(async () => { p1a.resolver({ ok: true, contatos: [{ id:'velho', tipo:'ligacao', nota:'Nota velha da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-08-01T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Carregando histórico')
    expect(tela.textContent).not.toContain('Nota velha da Aurora')

    // só a resposta do pedido novo aparece
    await act(async () => { p2a.resolver({ ok: true, contatos: [{ id:'novo', tipo:'ligacao', nota:'Nota nova da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-05T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota nova da Aurora')
    expect(tela.textContent).not.toContain('Nota velha da Aurora')
  })

  // O aviso oferece "Recarregar a agenda", um `Link` para a mesma rota: o
  // painel não remonta, só recebe `linhas`/`agenda` novos do servidor. Isso
  // prova que a contagem e o aviso reconciliam com a prop nova, em vez de
  // descontar a mesma remoção duas vezes (uma no cliente, outra porque o
  // servidor já não manda a empresa) — e sem nenhuma limpeza explícita de
  // `removidos`: os dois números da contagem saem de FILTRAR `linhas`/
  // `agenda` pelo id removido, não de subtrair um contador de um total
  // congelado, então uma vez que o id some de `agenda` também, filtrar por
  // ele já não muda nada.
  test('recarregar depois de posse negada não desconta a remoção duas vezes, e o aviso some', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })
    expect(tela.textContent).toContain('1 de 1 retorno')
    expect(tela.querySelector('[role="alert"]')).not.toBeNull()

    // "recarregar a agenda": o servidor já não manda mais a Aurora
    await act(async () => raiz?.render(<PainelMeuDia linhas={[boreal]} agenda={[boreal]} filtros={FILTROS} />))
    expect(tela.textContent).toContain('1 de 1 retorno')
    expect(tela.textContent).not.toContain('1 de 0')
    expect(tela.querySelector('[role="alert"]')).toBeNull()
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.textContent).toContain('Boreal')
  })

  // Cobre o outro lado: uma revalidação que ainda devolve a MESMA lista
  // (replicação atrasada, por exemplo) não pode trazer o item removido de
  // volta.
  test('revalidação que devolve a mesma lista não traz o item removido de volta', async () => {
    const p1 = pendente()
    acaoMock.mockReturnValueOnce(p1.promessa)
    const tela = await montar([aurora, boreal])
    await act(async () => { p1.resolver({ ok: false, motivo: 'fora_da_carteira' }) })
    expect(tela.textContent).toContain('1 de 1 retorno')

    // a mesma lista de antes chega de novo (nada mudou no servidor ainda)
    await act(async () => raiz?.render(<PainelMeuDia linhas={[aurora, boreal]} agenda={[aurora, boreal]} filtros={FILTROS} />))
    expect(tela.textContent).not.toContain('Aurora')
    expect(tela.textContent).toContain('1 de 1 retorno')
  })

  test('ida e volta A -> B -> A: nota antiga de A que já tinha chegado não reaparece durante o novo pedido', async () => {
    const p1a = pendente()
    acaoMock.mockReturnValueOnce(p1a.promessa)
    const tela = await montar([aurora, boreal])
    await act(async () => { p1a.resolver({ ok: true, contatos: [{ id:'velho', tipo:'ligacao', nota:'Nota velha da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-08-01T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota velha da Aurora')

    const pb = pendente()
    acaoMock.mockReturnValueOnce(pb.promessa)
    await clicar(tela, 'Boreal')

    const p2a = pendente()
    acaoMock.mockReturnValueOnce(p2a.promessa)
    await clicar(tela, 'Aurora')
    expect(tela.textContent).toContain('Carregando histórico')
    expect(tela.textContent).not.toContain('Nota velha da Aurora')

    await act(async () => { p2a.resolver({ ok: true, contatos: [{ id:'novo', tipo:'ligacao', nota:'Nota nova da Aurora', proximoPasso:null, proximoPassoData:null, criadoEm:new Date('2026-09-05T10:00:00Z'), autor:'Ana' }] }) })
    expect(tela.textContent).toContain('Nota nova da Aurora')
    expect(tela.textContent).not.toContain('Nota velha da Aurora')
  })
})
