import { describe, expect, test } from 'vitest'
import { ResultadoDesconhecido, traduzirResultado } from './repositorio'

describe('traduzirResultado', () => {
  test('vocabulário conhecido vira ok ou motivo', () => {
    expect(traduzirResultado('f', 'ok')).toEqual({ ok: true })
    expect(traduzirResultado('f', 'nao_encontrado')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(traduzirResultado('f', 'alvo_inativo')).toEqual({ ok: false, motivo: 'alvo_inativo' })
    expect(traduzirResultado('f', 'ja_nesse_estado')).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
  })

  test('valor desconhecido lança, não vira ok: false', () => {
    expect(() => traduzirResultado('credencial_definir', 'lixo')).toThrow(ResultadoDesconhecido)
    expect(() => traduzirResultado('credencial_definir', 'ok ')).toThrow(/"ok "/)
  })

  test('propriedade de Object.prototype não vira resultado', () => {
    expect(() => traduzirResultado('f', 'toString')).toThrow(ResultadoDesconhecido)
  })
})
