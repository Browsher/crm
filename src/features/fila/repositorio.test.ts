import { describe, expect, test } from 'vitest'
import { ResultadoDesconhecido, traduzirResultado } from './repositorio'

describe('traduzirResultado', () => {
  test('ok vira sucesso', () => {
    expect(traduzirResultado('empresa_assumir', 'ok')).toEqual({ ok: true })
  })

  const recusas: [string, string][] = [
    ['nao_encontrada', 'nao_encontrada'],
    ['reserva_expirada', 'reserva_expirada'],
    ['ja_e_sua', 'ja_e_sua'],
  ]
  for (const [valor, motivo] of recusas) {
    test(`${valor} vira falha com motivo proprio`, () => {
      expect(traduzirResultado('empresa_assumir', valor)).toEqual({ ok: false, motivo })
    })
  }

  test('valor fora do vocabulario LANCA, nao vira falha', () => {
    expect(() => traduzirResultado('empresa_assumir', 'talvez')).toThrow(ResultadoDesconhecido)
  })

  // Object.hasOwn, não indexação direta: sem isso 'toString' viraria resultado.
  test('nome de propriedade herdada nao vira resultado', () => {
    expect(() => traduzirResultado('empresa_assumir', 'toString')).toThrow(ResultadoDesconhecido)
  })
})
