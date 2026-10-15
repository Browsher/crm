import { expect, test } from 'vitest'
import { lerColetaSheets } from './entrada-sheets'

test('mantém a linha original e consulta o fixo compartilhado uma vez', () => {
  const r = lerColetaSheets([
    ['telefone', 'nome_empresa', 'place_id'],
    ['(11) 2600-0001', 'Empresa A', 'ChIJ-cenario-a'],
    [],
    ['+55 11 2600-0001', 'Empresa B', 'ChIJ-cenario-b'],
  ])
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.motivo)
  expect(r.coleta.numeros).toEqual(['551126000001'])
  expect(r.coleta.linhas.map(l => l.linha)).toEqual([2, 4])
})

test.each([
  [['telefone', 'telefone'], ['1126000001', '1126000002']],
  [['nome_empresa', 'telefone'], ['Empresa A', '1126000001']],
  [[' telefone'], ['1126000001']],
  [['Telefone'], ['1126000001']],
  [['telefone', 'nome_empresa', 'nome_empresa']],
  [['telefone', ''], ['1126000001', 'sem cabeçalho']],
  [['telefone'], ['1126000001', 'fora do cabeçalho']],
  [['telefone', 3], ['1126000001', 'Empresa A']],
  [['telefone'], [{ numero: '1126000001' }]],
  [['telefone'], [Number.NaN]],
  [],
])('recusa estrutura ilegível antes de publicar: %j', (...valores) => {
  expect(lerColetaSheets(valores)).toMatchObject({ ok: false, motivo: 'estrutura_invalida' })
})

test('recusa entradas que não são matrizes mesmo fora do contrato TypeScript', () => {
  for (const valores of [null, {}, ['telefone'], [['telefone'], null]]) {
    expect(lerColetaSheets(valores as unknown as unknown[][]))
      .toMatchObject({ ok: false, motivo: 'estrutura_invalida' })
  }
})

test.each([
  ['(11) 98765-4321', '5511987654321'],
  ['+55 (11) 98765-4321', '5511987654321'],
  ['1126000001', '551126000001'],
])('normaliza sem alterar os dígitos de %s', (telefone, numero) => {
  expect(lerColetaSheets([['telefone'], [telefone]]))
    .toMatchObject({ ok: true, coleta: { numeros: [numero], pendencias: [] } })
})

test('registra pendências de entrada sem classificá-las como números consultáveis', () => {
  const r = lerColetaSheets([
    ['telefone', 'nome_empresa'],
    ['1,12600E+09', 'Notação científica'],
    ['2600-0001', 'Sem DDD'],
    ['1126000001 / 1126000002', 'Dois números'],
    ['', 'Sem telefone'],
    ['0123', 'Não recupera dígitos'],
  ])
  expect(r).toEqual({ ok: true, coleta: {
    numeros: [],
    linhas: [
      { linha: 2, dados: { telefone: '1,12600E+09', nome_empresa: 'Notação científica' }, numero: null },
      { linha: 3, dados: { telefone: '2600-0001', nome_empresa: 'Sem DDD' }, numero: null },
      { linha: 4, dados: { telefone: '1126000001 / 1126000002', nome_empresa: 'Dois números' }, numero: null },
      { linha: 5, dados: { telefone: '', nome_empresa: 'Sem telefone' }, numero: null },
      { linha: 6, dados: { telefone: '0123', nome_empresa: 'Não recupera dígitos' }, numero: null },
    ],
    pendencias: [
      { linhas: [2], numero: null, motivo: 'telefone_invalido' },
      { linhas: [3], numero: null, motivo: 'ddd_ausente' },
      { linhas: [4], numero: null, motivo: 'telefone_invalido' },
      { linhas: [5], numero: null, motivo: 'telefone_ausente' },
      { linhas: [6], numero: null, motivo: 'telefone_invalido' },
    ],
  } })
})

test('cabeçalho sozinho e linhas totalmente vazias produzem coleta vazia', () => {
  for (const valores of [[['telefone']], [['telefone', 'nome_empresa'], [], ['', '  '], [null, undefined]]]) {
    expect(lerColetaSheets(valores)).toEqual({ ok: true, coleta: { linhas: [], numeros: [], pendencias: [] } })
  }
})

test('preserva dados literais, colunas extras e a matriz original sem mutação', () => {
  const valores = [
    ['telefone', '__proto__', 'nome_empresa', 'extra', 'ausente'],
    ['1126000001', 'literal', '=SUM(A2)', 12, null],
  ]
  const antes = structuredClone(valores)
  valores.forEach(Object.freeze)
  Object.freeze(valores)
  const r = lerColetaSheets(valores)
  expect(r).toMatchObject({ ok: true, coleta: { linhas: [{
    linha: 2,
    dados: { telefone: '1126000001', nome_empresa: '=SUM(A2)', extra: '12', ausente: '' },
  }] } })
  if (!r.ok) throw new Error(r.motivo)
  expect(Object.hasOwn(r.coleta.linhas[0].dados, '__proto__')).toBe(true)
  expect(r.coleta.linhas[0].dados.__proto__).toBe('literal')
  expect(valores).toEqual(antes)
})

test('mantém números únicos na ordem da primeira ocorrência', () => {
  expect(lerColetaSheets([['telefone'], ['1126000002'], ['1126000001'], ['+551126000002']]))
    .toMatchObject({ ok: true, coleta: { numeros: ['551126000002', '551126000001'] } })
})

test('aceita 5.000 empresas sem contar cabeçalho nem linhas vazias', () => {
  const valores = [['telefone'], ...Array.from({ length: 5000 }, () => ['1126000001']), [], [' ']]
  const r = lerColetaSheets(valores)
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error(r.motivo)
  expect(r.coleta.linhas).toHaveLength(5000)
  expect(r.coleta.numeros).toEqual(['551126000001'])
})

test('recusa 5.001 empresas integralmente em vez de truncar', () => {
  expect(lerColetaSheets([['telefone'], ...Array.from({ length: 5001 }, () => ['1126000001'])]))
    .toMatchObject({ ok: false, motivo: 'excede_limite' })
})

test('recusa matriz esparsa em vez de lançar exceção', () => {
  const valores: unknown[][] = [['telefone']]
  valores.length = 2
  expect(lerColetaSheets(valores)).toMatchObject({ ok: false, motivo: 'estrutura_invalida' })
})
