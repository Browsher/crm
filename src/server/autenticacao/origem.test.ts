import { expect, test } from 'vitest'
import { origemDe } from './origem'

test('primeiro endereço de x-forwarded-for, senão x-real-ip, senão nulo', () => {
  expect(origemDe(new Headers({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' }))).toBe('203.0.113.9')
  expect(origemDe(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  expect(origemDe(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  expect(origemDe(new Headers())).toBeNull()
})
