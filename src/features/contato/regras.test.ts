import { describe, expect, test } from 'vitest'
import { validar, type Rascunho } from './regras'

const BASE: Rascunho = {
  tipo: 'nao_atendeu',
  desfecho: 'devolver',
  nota: '',
  proximoPasso: '',
  proximoPassoData: '',
  posse: false,
}

describe('validar', () => {
  test('rascunho de reserva sem proximo passo e valido', () => {
    expect(validar(BASE)).toEqual({
      ok: true,
      valor: { tipo: 'nao_atendeu', desfecho: 'devolver', nota: null, proximoPasso: null, proximoPassoData: null },
    })
  })

  test('tipo fora da lista e recusado antes do banco', () => {
    expect(validar({ ...BASE, tipo: 'inventado' })).toEqual({ ok: false, falta: 'tipo_invalido' })
  })

  test('desfecho fora do vocabulario e recusado antes do banco', () => {
    expect(validar({ ...BASE, desfecho: 'talvez' })).toEqual({ ok: false, falta: 'desfecho_invalido' })
  })

  // A regra que existe por causa da posse. Sem ela, o vendedor assume uma
  // empresa e a agenda dele nasce vazia sem ninguém perceber.
  test('com posse, proximo passo e EXIGIDO', () => {
    const r = validar({ ...BASE, tipo: 'acompanhamento', desfecho: 'nenhum', posse: true })
    expect(r).toEqual({ ok: false, falta: 'proximo_passo_exigido' })
  })

  test('com posse e proximo passo completo, passa', () => {
    const r = validar({
      ...BASE,
      tipo: 'acompanhamento',
      desfecho: 'nenhum',
      posse: true,
      proximoPasso: 'Mandar orçamento',
      proximoPassoData: '2026-10-01',
    })
    expect(r).toEqual({
      ok: true,
      valor: {
        tipo: 'acompanhamento',
        desfecho: 'nenhum',
        nota: null,
        proximoPasso: 'Mandar orçamento',
        proximoPassoData: '2026-10-01',
      },
    })
  })

  const incompletos: [string, Partial<Rascunho>][] = [
    ['passo sem data', { proximoPasso: 'Ligar em março', proximoPassoData: '' }],
    ['data sem passo', { proximoPasso: '', proximoPassoData: '2026-10-01' }],
  ]
  for (const [nome, patch] of incompletos) {
    test(`${nome} e recusado antes do banco, e nao vira 23514 na tela`, () => {
      expect(validar({ ...BASE, ...patch })).toEqual({ ok: false, falta: 'par_incompleto' })
    })
  }

  // `retornar_depois` grava passo e data SEM posse de propósito: é o histórico
  // que a próxima pessoa lê e o dado que calibra o segundo prazo. A tela avisa
  // que a empresa volta em 30 dias; a regra não proíbe.
  test('retornar_depois grava passo e data mesmo sem posse', () => {
    const r = validar({
      ...BASE,
      tipo: 'retornar_depois',
      proximoPasso: 'Retomar contato',
      proximoPassoData: '2027-03-02',
    })
    expect(r).toEqual({
      ok: true,
      valor: {
        tipo: 'retornar_depois',
        desfecho: 'devolver',
        nota: null,
        proximoPasso: 'Retomar contato',
        proximoPassoData: '2027-03-02',
      },
    })
  })

  test('espaco em branco vira nulo, nao string vazia — o CHECK do banco recusa vazio', () => {
    const r = validar({ ...BASE, nota: '   ' })
    expect(r).toEqual({ ok: true, valor: expect.objectContaining({ nota: null }) })
  })
})

// Achado da verificação manual: "Registrar e devolver" exigia próximo passo.
// A empresa está SAINDO da carteira — não há o que combinar com quem você não
// vai mais ligar. A tela raciocinava sobre o estado anterior à ação (`posse`)
// em vez de sobre o desfecho dela.
describe('validar: o que decide é o desfecho, não o estado anterior', () => {
  const naCarteira: Rascunho = {
    tipo: 'acompanhamento',
    desfecho: 'nenhum',
    nota: '',
    proximoPasso: '',
    proximoPassoData: '',
    posse: true,
  }

  test('posse com desfecho nenhum EXIGE proximo passo, porque a empresa fica', () => {
    expect(validar(naCarteira)).toEqual({ ok: false, falta: 'proximo_passo_exigido' })
  })

  test('posse com desfecho devolver NAO exige, porque a empresa sai', () => {
    expect(validar({ ...naCarteira, desfecho: 'devolver' })).toEqual({
      ok: true,
      valor: {
        tipo: 'acompanhamento',
        desfecho: 'devolver',
        nota: null,
        proximoPasso: null,
        proximoPassoData: null,
      },
    })
  })

  test('devolver com proximo passo preenchido continua valendo, e vira historico', () => {
    const r = validar({
      ...naCarteira,
      desfecho: 'devolver',
      proximoPasso: 'Retomar em marco',
      proximoPassoData: '2027-03-02',
    })
    expect(r).toEqual({ ok: true, valor: expect.objectContaining({ proximoPasso: 'Retomar em marco' }) })
  })
})
