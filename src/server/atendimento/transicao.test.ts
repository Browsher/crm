import { describe, expect, test } from 'vitest'
import { classificarVinculoLegado } from './transicao'

describe('classificarVinculoLegado', () => {
  test('preserva responsável compatível mesmo com entrega antiga para outro vendedor', () => {
    expect(classificarVinculoLegado({ responsavel: 'A', google: null, candidatos: ['B'], ativos: ['A', 'B'] }))
      .toEqual({ tipo: 'vincular', vendedorId: 'A' })
  })

  test('contradição com exclusividade Google não escolhe vencedor', () => {
    expect(classificarVinculoLegado({ responsavel: 'A', google: 'B', candidatos: ['A', 'B'], ativos: ['A', 'B'] }))
      .toEqual({ tipo: 'pendente', motivo: 'conflito_google' })
  })

  test.each([
    [{ responsavel: 'A', google: null, candidatos: ['B'], ativos: ['B'] }, 'responsavel_inativo'],
    [{ responsavel: null, google: 'A', candidatos: ['B'], ativos: ['B'] }, 'google_inativo'],
    [{ responsavel: null, google: null, candidatos: ['A', 'B'], ativos: ['B'] }, 'candidato_inativo'],
    [{ responsavel: null, google: null, candidatos: ['A', 'B'], ativos: ['A', 'B'] }, 'multiplos_candidatos'],
    [{ responsavel: null, google: null, candidatos: [], ativos: ['A'] }, 'sem_evidencia'],
  ])('mantém ambiguidade pendente (%s)', (entrada, motivo) => {
    expect(classificarVinculoLegado(entrada)).toEqual({ tipo: 'pendente', motivo })
  })

  test('Google ativo é autoritativo quando não existe responsável', () => {
    expect(classificarVinculoLegado({ responsavel: null, google: 'A', candidatos: ['B'], ativos: ['A', 'B'] }))
      .toEqual({ tipo: 'vincular', vendedorId: 'A' })
  })

  test('uma única entrega recuperável pode vincular, sem duplicar candidatos', () => {
    expect(classificarVinculoLegado({ responsavel: null, google: null, candidatos: ['A', 'A'], ativos: ['A'] }))
      .toEqual({ tipo: 'vincular', vendedorId: 'A' })
  })
})
