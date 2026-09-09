import { describe, expect, test } from 'vitest'
import { campoCsv, linhaDoJson, paraCsv } from './linha'

const completo = JSON.stringify({
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  complemento: 'lado ímpar',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
  ibge: '3550308',
})

describe('linhaDoJson', () => {
  test('tira o hífen do cep e move complemento para faixa', () => {
    expect(linhaDoJson(completo)).toEqual({
      cep: '01001000',
      logradouro: 'Praça da Sé',
      faixa: 'lado ímpar',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
    })
  })

  test('string vazia vira null, não string vazia', () => {
    const texto = JSON.stringify({
      cep: '69900-001',
      logradouro: '',
      complemento: '',
      bairro: '',
      localidade: 'Rio Branco',
      uf: 'AC',
      ibge: '1200401',
    })
    expect(linhaDoJson(texto)).toMatchObject({ logradouro: null, faixa: null, bairro: null })
  })

  test.each<[string, string]>([
    ['{ isto não é json', 'json quebrado'],
    ['{"cep":"123"}', 'cep curto'],
    ['{"cep":"01001-000","localidade":"","uf":"SP","ibge":"3550308"}', 'localidade vazia'],
    ['{"cep":"01001-000","localidade":"X","uf":"","ibge":"3550308"}', 'uf vazia'],
    ['{"cep":"01001-000","localidade":"X","uf":"SP","ibge":"355030"}', 'ibge com seis dígitos'],
  ])('%s (%s) vira null', (texto) => {
    expect(linhaDoJson(texto)).toBeNull()
  })
})

describe('campoCsv', () => {
  test.each<[string | null, string]>([
    [null, ''],
    ['Rua Simples', 'Rua Simples'],
    ['Rua A, 100', '"Rua A, 100"'],
    ['Rua "Aspas"', '"Rua ""Aspas"""'],
    ['Rua\ncom quebra', '"Rua\ncom quebra"'],
  ])('%s vira %s', (entrada, esperado) => {
    expect(campoCsv(entrada)).toBe(esperado)
  })

  test('null vira campo vazio SEM aspas, que é como o COPY CSV lê NULL', () => {
    // No COPY ... WITH (FORMAT csv), campo vazio sem aspas é NULL e "" é string
    // vazia. Como nunca guardamos string vazia, a distinção é inequívoca.
    expect(campoCsv(null)).toBe('')
    expect(campoCsv('')).toBe('""')
  })
})

describe('paraCsv', () => {
  test('sete campos na ordem das colunas, terminando em quebra de linha', () => {
    expect(paraCsv(linhaDoJson(completo)!)).toBe('01001000,Praça da Sé,lado ímpar,Sé,São Paulo,SP,3550308\n')
  })
})
