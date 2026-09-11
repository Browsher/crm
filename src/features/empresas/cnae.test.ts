import { expect, test } from 'vitest'
import { normalizarCnae } from './cnae'

test.each([
  ['', { ok: true, valor: null }],
  ['  ', { ok: true, valor: null }],
  ['4742-3/00', { ok: true, valor: '4742300' }],
  [' 4742300 ', { ok: true, valor: '4742300' }],
  ['0111301', { ok: true, valor: '0111301' }],
  ['abc4742300', { ok: false }],
  ['474230', { ok: false }],
  ['47423000', { ok: false }],
  ['4742/3-00', { ok: false }],
  ['4742 300', { ok: false }],
])('normaliza %s', (entrada, esperado) => {
  expect(normalizarCnae(entrada as string)).toEqual(esperado)
})
