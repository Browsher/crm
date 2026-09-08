import { expect, test } from 'vitest'
import { decidirRota } from './rota'

test('sem cookie: rota protegida vai para /login; pública passa', () => {
  expect(decidirRota('/', false)).toBe('/login')
  expect(decidirRota('/usuarios/abc', false)).toBe('/login')
  expect(decidirRota('/login', false)).toBeNull()
  expect(decidirRota('/login/', false)).toBeNull()
  expect(decidirRota('/loginx', false)).toBe('/login')
})

test('com cookie: nunca redireciona; quem decide é a página', () => {
  expect(decidirRota('/', true)).toBeNull()
  expect(decidirRota('/login', true)).toBeNull()
})
