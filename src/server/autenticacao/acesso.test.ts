import { describe, expect, test } from 'vitest'
import { avaliarAcesso } from './acesso'
import type { Sessao } from './sessao'

const sessao = (extra: Partial<Sessao> = {}): Sessao => ({
  usuarioId: 'u',
  nome: 'N',
  email: 'n@x',
  papel: 'vendedor',
  senhaProvisoriaPendente: false,
  expiraEm: new Date(),
  ...extra,
})

describe('avaliarAcesso', () => {
  test('sem sessão: /login em qualquer exigência', () => {
    for (const ex of ['sessao', 'usuario', 'gestor'] as const) {
      expect(avaliarAcesso(null, ex)).toEqual({ ok: false, motivo: 'sem_sessao', destino: '/login' })
    }
  })

  test('pendente: só "sessao" passa; o resto vai para /trocar-senha', () => {
    const s = sessao({ senhaProvisoriaPendente: true, papel: 'gestor' })
    expect(avaliarAcesso(s, 'sessao')).toEqual({ ok: true, usuario: s })
    expect(avaliarAcesso(s, 'usuario')).toEqual({ ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' })
    expect(avaliarAcesso(s, 'gestor')).toEqual({ ok: false, motivo: 'senha_provisoria', destino: '/trocar-senha' })
  })

  test('vendedor em exigência gestor vai para /', () => {
    expect(avaliarAcesso(sessao(), 'gestor')).toEqual({ ok: false, motivo: 'so_gestor', destino: '/' })
  })

  test('gestor sem pendência passa em tudo', () => {
    const g = sessao({ papel: 'gestor' })
    for (const ex of ['sessao', 'usuario', 'gestor'] as const) expect(avaliarAcesso(g, ex)).toEqual({ ok: true, usuario: g })
  })
})
