import { describe, expect, test } from 'vitest'
import { corpoDe, somaDe } from './arquivos'

describe('somaDe', () => {
  test('sha256 hex do conteúdo inteiro', () => {
    expect(somaDe('BEGIN;\nSELECT 1;\nCOMMIT;\n')).toMatch(/^[0-9a-f]{64}$/)
  })

  test('qualquer byte diferente muda a soma, inclusive comentário', () => {
    const a = somaDe('-- a\nBEGIN;\nSELECT 1;\nCOMMIT;\n')
    const b = somaDe('-- b\nBEGIN;\nSELECT 1;\nCOMMIT;\n')
    expect(a).not.toBe(b)
  })
})

describe('corpoDe', () => {
  test('remove a primeira e a última linha', () => {
    expect(corpoDe('BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;\n')).toBe('CREATE TABLE x (id int);')
  })

  test('ignora linhas vazias nas pontas e mantém o miolo intacto', () => {
    expect(corpoDe('\nBEGIN;\nA;\n\nB;\nCOMMIT;\n\n')).toBe('A;\n\nB;')
  })

  test('remoção é posicional: não procura BEGIN no meio', () => {
    expect(corpoDe("BEGIN;\nSELECT 'BEGIN;';\nCOMMIT;")).toBe("SELECT 'BEGIN;';")
  })

  test('comentário de uma linha no topo fica antes do BEGIN e é removido junto', () => {
    expect(corpoDe('-- ver docs/db/0001.md\nBEGIN;\nA;\nCOMMIT;')).toBe('A;')
  })
})
