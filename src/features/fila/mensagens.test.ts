import { describe, expect, test } from 'vitest'
import { textoDoMotivo } from './mensagens'
import type { Motivo } from './repositorio'

const MOTIVOS: Motivo[] = ['sem_permissao', 'nao_encontrada', 'reserva_expirada', 'ja_e_sua']

describe('textoDoMotivo', () => {
  for (const m of MOTIVOS) {
    test(`${m} tem texto de gente`, () => {
      const texto = textoDoMotivo(m)
      expect(texto.length).toBeGreaterThan(10)
      expect(texto).not.toContain('_')
    })
  }
})
