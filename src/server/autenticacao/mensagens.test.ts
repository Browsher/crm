import { expect, test } from 'vitest'
import { mensagemDeLogin, mensagemDeTroca } from './mensagens'

test('login: inválidas e bloqueado com minutos arredondados para cima', () => {
  expect(mensagemDeLogin({ ok: false, motivo: 'credenciais_invalidas' })).toBe('E-mail ou senha não conferem.')
  expect(mensagemDeLogin({ ok: false, motivo: 'bloqueado', segundosRestantes: 61 })).toBe('Muitas tentativas. Tente de novo em 2 minutos.')
  expect(mensagemDeLogin({ ok: false, motivo: 'bloqueado', segundosRestantes: 30 })).toBe('Muitas tentativas. Tente de novo em 1 minuto.')
})

test('troca: faltas em texto, senha atual, sem sessão', () => {
  expect(mensagemDeTroca({ ok: false, motivo: 'senha_fraca', faltas: ['minimo', 'igual_atual'] })).toBe(
    'A nova senha precisa ter pelo menos 8 caracteres e ser diferente da atual.',
  )
  expect(mensagemDeTroca({ ok: false, motivo: 'senha_atual_invalida' })).toBe('A senha atual não confere.')
  expect(mensagemDeTroca({ ok: false, motivo: 'sem_sessao' })).toBe('Sua sessão acabou. Entre de novo.')
})
