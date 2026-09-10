import { describe, expect, test } from 'vitest'
import { ResultadoDesconhecido, traduzirResultado } from './repositorio'

describe('traduzirResultado', () => {
  test('ok vira sucesso', () => {
    expect(traduzirResultado('contato_registrar', 'ok')).toEqual({ ok: true })
  })

  const recusas: [string, string][] = [
    ['nao_encontrada', 'nao_encontrada'],
    ['reserva_expirada', 'reserva_expirada'],
    ['ja_e_sua', 'ja_e_sua'],
  ]
  for (const [valor, motivo] of recusas) {
    test(`${valor} vira falha com motivo proprio`, () => {
      expect(traduzirResultado('contato_registrar', valor)).toEqual({ ok: false, motivo })
    })
  }

  test('valor fora do vocabulario LANCA, nao vira falha', () => {
    expect(() => traduzirResultado('contato_registrar', 'talvez')).toThrow(ResultadoDesconhecido)
  })

  test('nome de propriedade herdada nao vira resultado', () => {
    expect(() => traduzirResultado('contato_registrar', 'toString')).toThrow(ResultadoDesconhecido)
  })
})
