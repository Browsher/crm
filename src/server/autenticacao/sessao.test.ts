import { expect, test } from 'vitest'
import { gerarToken, hashDoToken } from './sessao'

test('token: 32 bytes em base64url, sem padding, sempre diferente', () => {
  const a = gerarToken()
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(gerarToken()).not.toBe(a)
})

test('hash do token é sha256 hex, determinístico', () => {
  expect(hashDoToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(hashDoToken('abc')).toBe(hashDoToken('abc'))
})
