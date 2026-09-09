import { describe, expect, test } from 'vitest'
import { normalizarCep } from './resolver'

describe('normalizarCep', () => {
  test.each([
    ['01310-100', '01310100'],
    ['01310100', '01310100'],
    ['  01310100  ', '01310100'],
    ['01310.100', '01310100'],
    ['01310 100', '01310100'],
  ])('%s vira %s', (bruto, esperado) => {
    expect(normalizarCep(bruto)).toBe(esperado)
  })

  test.each([
    ['', 'vazio'],
    ['   ', 'só espaço'],
    ['0131010', 'sete dígitos'],
    ['013101000', 'nove dígitos'],
    ['consultar', 'texto'],
    ['0131010a', 'letra no meio'],
  ])('%s (%s) vira null', (bruto) => {
    expect(normalizarCep(bruto)).toBeNull()
  })

  test('não confunde separador com dígito: 12-34-56-78 tem oito dígitos', () => {
    expect(normalizarCep('12-34-56-78')).toBe('12345678')
  })
})
