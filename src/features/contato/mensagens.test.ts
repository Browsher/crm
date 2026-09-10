import { describe, expect, test } from 'vitest'
import { textoDaFalta, textoDoMotivo } from './mensagens'
import type { Falta } from './regras'
import type { Motivo } from './repositorio'

describe('textoDoMotivo', () => {
  const motivos: Motivo[] = ['sem_permissao', 'nao_encontrada', 'reserva_expirada', 'ja_e_sua']
  for (const m of motivos) {
    test(`${m} tem texto proprio e nao vazio`, () => {
      expect(textoDoMotivo(m).length).toBeGreaterThan(0)
    })
  }

  test('reserva_expirada explica que o tempo acabou, e nao fala em permissao', () => {
    expect(textoDoMotivo('reserva_expirada')).not.toContain('permissão')
  })
})

describe('textoDaFalta', () => {
  const faltas: Falta[] = ['tipo_invalido', 'desfecho_invalido', 'proximo_passo_exigido', 'par_incompleto']
  for (const f of faltas) {
    test(`${f} tem texto proprio`, () => {
      expect(textoDaFalta(f).length).toBeGreaterThan(0)
    })
  }

  test('proximo_passo_exigido diz o que fazer, nao so que faltou', () => {
    expect(textoDaFalta('proximo_passo_exigido')).toContain('próximo passo')
  })
})
