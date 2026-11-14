import { expect, test } from 'vitest'
import { detalhesAtividade, FILTROS_ATIVIDADE, filtrosAtividade, tituloAtividade, type EventoAtividade } from './atividade-gestao'

const busca: EventoAtividade = { id: 'busca', vendedorId: 'vendedor', vendedor: 'Ana', em: '2026-11-13T14:00:00Z',
  categoria: 'banco', subtipo: 'concluida', empresaId: null, empresa: null, dados: { retornadas: 10, entregues: 1 } }

test('distingue resultado bruto, entrega confirmada, zero e quantidade desconhecida', () => {
  expect(tituloAtividade(busca)).toBe('Ana recebeu 1 empresa do Banco')
  expect(detalhesAtividade(busca)).toContainEqual({ rotulo: 'Fora da entrega', valor: '9' })
  const antiga = { ...busca, dados: { retornadas: 10, entregues: null } }
  expect(detalhesAtividade(antiga)).toContainEqual({ rotulo: 'Novas empresas na prospecção', valor: 'Quantidade não registrada' })
  expect(detalhesAtividade(antiga).some(linha => linha.rotulo === 'Fora da entrega')).toBe(false)
  expect(tituloAtividade({ ...busca, dados: { entregues: 0 } })).toContain('sem novas empresas')
})

test('valida argumentos da consulta inclusive enums herdados e paginação fora do limite', () => {
  expect(filtrosAtividade(FILTROS_ATIVIDADE)).toEqual(FILTROS_ATIVIDADE)
  for (const valores of [{ tipo: 'toString' }, { periodo: 'constructor' }, { vendedorId: ['x'] }, { pagina: 100_001 }, { pagina: 1.5 }]) {
    expect(filtrosAtividade({ ...FILTROS_ATIVIDADE, ...valores })).toBeNull()
  }
})
