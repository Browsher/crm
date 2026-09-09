import { describe, expect, test } from 'vitest'
import { normalizarTelefone } from './telefone'

describe('normalizarTelefone', () => {
  const casos: [string, string | null][] = [
    ['(11) 98765-4321', '11987654321'],
    ['11 3456-7890', '1134567890'],
    ['  11987654321 ', '11987654321'],
    ['+55 11 98765-4321', null],
    ['987654321', null],
    ['119876543210', null],
    ['', null],
    ['ligar de manha', null],
  ]
  for (const [entrada, esperado] of casos) {
    test(`${JSON.stringify(entrada)} vira ${JSON.stringify(esperado)}`, () => {
      expect(normalizarTelefone(entrada)).toBe(esperado)
    })
  }
})
