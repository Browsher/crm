import { expect, test } from 'vitest'
import { rascunhoInicial, rascunhoAlterado } from './rascunho'

test('rascunho inicial escolhe o tipo compatível com posse', () => {
  expect(rascunhoInicial(false)).toEqual({ tipo: 'nao_liguei', nota: '', proximoPasso: '', proximoPassoData: '' })
  expect(rascunhoInicial(true).tipo).toBe('acompanhamento')
  expect(rascunhoAlterado(rascunhoInicial(false))).toBe(false)
})

test('qualquer campo ou escolha diferente identifica anotações a preservar', () => {
  for (const campo of ['nota', 'proximoPasso', 'proximoPassoData']) {
    expect(rascunhoAlterado({ ...rascunhoInicial(false), [campo]: ' ' })).toBe(true)
  }
  expect(rascunhoAlterado({ ...rascunhoInicial(false), tipo: 'interessado' })).toBe(true)
})
