import { describe, expect, test } from 'vitest'
import { formatarCnpj, formatarTelefone } from './formato'

describe('formatarCnpj', () => {
  test('numérico', () => {
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  // O alfanumérico está em vigor desde 2026-07-06 e ocupa as mesmas posições:
  // a máscara é a mesma, sem caso especial.
  test('alfanumérico', () => {
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35')
  })

  // Valor fora de forma nunca deveria estar no banco (o CHECK da 0014 impede),
  // mas mostrar o que está lá é melhor que mostrar uma máscara mentirosa.
  test('valor fora de forma sai como veio', () => {
    expect(formatarCnpj('123')).toBe('123')
  })
})

describe('formatarTelefone', () => {
  test('celular, 11 dígitos', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321')
  })

  test('fixo, 10 dígitos', () => {
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444')
  })

  test('valor fora de forma sai como veio', () => {
    expect(formatarTelefone('123')).toBe('123')
  })
})
