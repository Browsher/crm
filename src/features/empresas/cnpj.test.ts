import { describe, expect, test } from 'vitest'
import { normalizarCnpj, pareceNotacaoCientifica, validarCnpj } from './cnpj'

describe('normalizarCnpj', () => {
  const casos: [string, string | null][] = [
    ['11.222.333/0001-81', '11222333000181'],
    ['  11222333000181  ', '11222333000181'],
    ['ab12c3d40e9f45', 'AB12C3D40E9F45'],
    ['1122233300018', null],
    ['112223330001812', null],
    ['', null],
    ['112223330001A1', null],
    ['CNPJ: consultar', null],
  ]
  for (const [entrada, esperado] of casos) {
    test(`${JSON.stringify(entrada)} vira ${JSON.stringify(esperado)}`, () => {
      expect(normalizarCnpj(entrada)).toBe(esperado)
    })
  }
})

describe('validarCnpj', () => {
  test('numerico valido', () => {
    expect(validarCnpj('11222333000181')).toBe(true)
  })

  test('numerico com um digito trocado reprova', () => {
    expect(validarCnpj('11222333000182')).toBe(false)
  })

  test('todos os digitos iguais reprova', () => {
    expect(validarCnpj('11111111111111')).toBe(false)
  })

  test('alfanumerico valido', () => {
    expect(validarCnpj('12ABC34501DE35')).toBe(true)
  })

  test('alfanumerico com DV errado reprova', () => {
    expect(validarCnpj('12ABC34501DE36')).toBe(false)
  })
})

describe('pareceNotacaoCientifica', () => {
  const sim = ['1,23457E+13', '1.23457E+13', '1,1E13']
  const nao = ['11222333000181', 'AB12C3D40E9F45', '']
  for (const v of sim) {
    test(`${v} e notacao cientifica`, () => expect(pareceNotacaoCientifica(v)).toBe(true))
  }
  for (const v of nao) {
    test(`${JSON.stringify(v)} nao e`, () => expect(pareceNotacaoCientifica(v)).toBe(false))
  }
})
