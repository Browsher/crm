import { expect, test } from 'vitest'
import { autorizarAgente } from './autenticacao'
const usuario = '00000000-0000-4000-8000-000000000001'
const config = { token: 'segredo-de-teste-com-pelo-menos-32-caracteres', usuarioId: usuario }
test('sem conexão configurada falha fechado, inclusive com bearer vazio', () => {
  expect(autorizarAgente('Bearer ', {})).toEqual({ ok: false, status: 503 })
})
test('somente token correto recebe a identidade configurada no servidor', () => {
  expect(autorizarAgente('Bearer ' + config.token, config)).toEqual({ ok: true, usuarioId: usuario })
  expect(autorizarAgente('Bearer errado', config)).toEqual({ ok: false, status: 401 })
  expect(autorizarAgente(null, config)).toEqual({ ok: false, status: 401 })
})
