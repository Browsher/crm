import { expect, test } from 'vitest'
import { conferirSaidas, prepararPublicacao, rangeA1 } from './sheets-simples'
import type { GradesSimples, RequestSheets } from './sheets-simples'
import type { SaidasSimples } from './simples-modelo'

type Celula = { valor: string; nota: string; formato: string }
type Aba = { linhas: number; colunas: number; celulas: Celula[][] }
type Grade = Record<number, Aba>
type Faixa = { sheetId: number; startRowIndex: number; endRowIndex?: number; startColumnIndex: number; endColumnIndex: number }

const destinos = { validacao: 10, exportacao: 11 }
const execucao = { id: 'exec-cenario', data: '2026-10-15T12:00:00.000Z' }
const grades: GradesSimples = {
  validacao: { linhas: 6, colunas: 3 }, exportacao: { linhas: 6, colunas: 12 },
}
const colunasCrm = ['cnpj', 'razao_social', 'nome_fantasia', 'contato_nome', 'telefone', 'email', 'cep', 'cnae_principal', 'google_place_id']
const vazias = (): SaidasSimples => ({ validos: [], invalidos: [], exportacao: [], pendencias: [], compartilhados: [], duplicadas: [] })
const celula = (): Celula => ({ valor: '', nota: 'nota anterior', formato: 'texto e cor anteriores' })

function cenario(): Grade {
  const criar = (linhas: number, colunas: number): Aba => ({ linhas, colunas, celulas: Array.from({ length: linhas }, () => Array.from({ length: colunas }, celula)) })
  const grade = { 10: criar(6, 3), 11: criar(6, 12), 10151001: criar(1, 1), 20: criar(1, 1), 21: criar(1, 1), 22: criar(1, 1) }
  for (const id of [10, 11]) {
    const aba = grade[id as 10 | 11]
    for (const linha of aba.celulas) for (const campo of linha.slice(0, id === 10 ? 2 : 9)) campo.valor = 'valor antigo'
  }
  grade[10151001].celulas[0][0].valor = 'origem preservada'
  grade[20].celulas[0][0].valor = 'histórico preservado'
  return grade
}

// Subconjunto explícito do batchUpdate. O lote só é aplicado se todos os requests
// forem válidos, como a API: o candidato clonado é descartado em caso de falha.
function aplicar(grade: Grade, requests: RequestSheets[]): Grade {
  const candidata = structuredClone(grade)
  for (const request of requests) {
    expect(Object.keys(request)).toHaveLength(1)
    if ('updateSheetProperties' in request) {
      const atualizacao = request.updateSheetProperties as { properties: { sheetId: number; gridProperties: { rowCount: number; columnCount: number } }; fields: string }
      const { sheetId, gridProperties } = atualizacao.properties
      const aba = candidata[sheetId]
      expect(aba).toBeDefined()
      expect(atualizacao.fields).toBe('gridProperties.rowCount,gridProperties.columnCount')
      expect(gridProperties.rowCount).toBeGreaterThanOrEqual(aba.linhas)
      expect(gridProperties.columnCount).toBeGreaterThanOrEqual(aba.colunas)
      aba.linhas = gridProperties.rowCount
      aba.colunas = gridProperties.columnCount
      aba.celulas = Array.from({ length: aba.linhas }, (_, l) => Array.from({ length: aba.colunas }, (_, c) => aba.celulas[l]?.[c] ?? celula()))
      continue
    }
    expect('repeatCell' in request || 'updateCells' in request).toBe(true)
    const operacao = (request.repeatCell ?? request.updateCells) as {
      range: Faixa; fields: string; cell?: Record<string, unknown>
      rows?: { values: { userEnteredValue?: { stringValue: string }; note?: string }[] }[]
    }
    const { range, fields } = operacao
    const aba = candidata[range.sheetId]
    if (!aba || range.startRowIndex < 0 || range.startColumnIndex < 0
      || range.endColumnIndex > aba.colunas || (range.endRowIndex ?? aba.linhas) > aba.linhas) throw new Error('range fora da grade')
    if ('repeatCell' in request) {
      expect(fields).toBe('userEnteredValue')
      expect(operacao.cell).toEqual({})
      expect(range.startRowIndex).toBe(0)
      expect(range.startColumnIndex).toBe(0)
      expect(range.endRowIndex).toBeUndefined()
      for (let l = 0; l < aba.linhas; l++) for (let c = 0; c < range.endColumnIndex; c++) aba.celulas[l][c].valor = ''
      continue
    }
    expect(['note', 'userEnteredValue']).toContain(fields)
    expect(operacao.rows).toHaveLength((range.endRowIndex ?? 0) - range.startRowIndex)
    operacao.rows!.forEach((linha, l) => {
      expect(linha.values).toHaveLength(range.endColumnIndex - range.startColumnIndex)
      linha.values.forEach((campo, c) => {
        expect(Object.keys(campo)).toEqual([fields])
        const alvo = aba.celulas[range.startRowIndex + l][range.startColumnIndex + c]
        if (fields === 'note') alvo.nota = campo.note!
        else {
          expect(Object.keys(campo.userEnteredValue!)).toEqual(['stringValue'])
          expect(typeof campo.userEnteredValue!.stringValue).toBe('string')
          alvo.valor = campo.userEnteredValue!.stringValue
        }
      })
    })
  }
  return candidata
}

function valores(grade: Grade) {
  return { validacao: grade[10].celulas.map(l => l.map(c => c.valor)), exportacao: grade[11].celulas.map(l => l.map(c => c.valor)) }
}

test('uma sobra da execução anterior impede confirmação de sucesso', () => {
  const plano = prepararPublicacao(destinos, { ...vazias(), validos: ['551126000001'] }, execucao, grades)
  expect(conferirSaidas(plano.esperado, {
    validacao: [['Válidos', 'Inválidos'], ['551126000001', ''], ['sobra', '']], exportacao: plano.esperado.exportacao,
  })).toEqual({ ok: false, motivo: 'gravacao_incompleta' })
})

test.each([
  { nome: 'lista menor', validos: ['551126000001'], invalidos: ['551126000002'], esperado: [['Válidos', 'Inválidos'], ['551126000001', '551126000002']] },
  { nome: 'nenhum válido', validos: [], invalidos: ['551126000002', '551126000003'], esperado: [['Válidos', 'Inválidos'], ['', '551126000002'], ['', '551126000003']] },
  { nome: 'nenhum inválido', validos: ['551126000001'], invalidos: [], esperado: [['Válidos', 'Inválidos'], ['551126000001', '']] },
  { nome: 'fonte vazia', validos: [], invalidos: [], esperado: [['Válidos', 'Inválidos']] },
])('substitui lista antiga maior: $nome', ({ validos, invalidos, esperado }) => {
  const original = cenario()
  const plano = prepararPublicacao(destinos, { ...vazias(), validos, invalidos }, execucao, grades)
  const iniciada = aplicar(original, plano.inicio)
  expect(valores(iniciada)).toEqual(valores(original))
  for (const id of [10, 11]) for (const campo of iniciada[id].celulas[0].slice(0, id === 10 ? 2 : 9)) {
    expect(campo.nota).toContain('em processamento')
    expect(campo.nota).toContain(execucao.id)
    expect(campo.nota).toContain(execucao.data)
  }
  const escrita = aplicar(iniciada, plano.dados)
  expect(escrita[10].celulas.slice(0, esperado.length).map(l => l.slice(0, 2).map(c => c.valor))).toEqual(esperado)
  expect(escrita[10].celulas.slice(esperado.length).every(l => l.every(c => c.valor === ''))).toBe(true)
  expect(escrita[11].celulas[0].slice(0, 9).map(c => c.valor)).toEqual(colunasCrm)
  expect(escrita[11].celulas.slice(1).every(l => l.every(c => c.valor === ''))).toBe(true)
  expect(conferirSaidas(plano.esperado, valores(escrita))).toEqual({ ok: true })
  expect(escrita[10].celulas[0][0].nota).toContain('em processamento')
  const concluida = aplicar(escrita, plano.conclusao)
  expect(valores(concluida)).toEqual(valores(escrita))
  expect(concluida[10].linhas).toBe(6)
  expect(concluida[11].colunas).toBe(12)
  expect(concluida[10].celulas[0][0].nota).toContain('concluído')
  expect(concluida[10].celulas[0][0].nota).not.toContain('em processamento')
  expect(concluida[10].celulas[1][0].nota).toBe('nota anterior')
  expect(concluida[11].celulas[5][8].formato).toBe('texto e cor anteriores')
  for (const id of [10151001, 20, 21, 22]) expect(concluida[id]).toEqual(original[id])
})

test('expande grades insuficientes antes de escrever, sem reduzir as dimensões existentes', () => {
  const saidas = { ...vazias(), validos: Array.from({ length: 8 }, (_, i) => '55112600000' + i) }
  const plano = prepararPublicacao(destinos, saidas, execucao, {
    validacao: { linhas: 6, colunas: 3 }, exportacao: { linhas: 6, colunas: 2 },
  })
  const grade = cenario()
  grade[11].colunas = 2
  grade[11].celulas = grade[11].celulas.map(l => l.slice(0, 2))
  const iniciada = aplicar(grade, plano.inicio)
  expect(iniciada[11].celulas[0][0].nota).toContain('em processamento')
  const escrita = aplicar(iniciada, plano.dados)
  expect([escrita[10].linhas, escrita[10].colunas]).toEqual([9, 3])
  expect([escrita[11].linhas, escrita[11].colunas]).toEqual([6, 9])
  expect(conferirSaidas(plano.esperado, valores(escrita))).toEqual({ ok: true })
  expect(rangeA1('Validação', escrita[10].linhas, escrita[10].colunas)).toBe("'Validação'!A1:C9")
})

test('escreve fórmula, telefone, CEP e CNPJ como textos literais, com nove colunas', () => {
  const linha = ['11222333000181', '', '=Empresa literal', '', '1126000001', '', '01310100', '', 'ChIJ-a']
  const plano = prepararPublicacao(destinos, { ...vazias(), exportacao: [linha] }, execucao, grades)
  expect(plano.esperado.exportacao).toEqual([colunasCrm, linha])
  const escrita = aplicar(cenario(), plano.dados)
  expect(escrita[11].celulas[1].slice(0, 9).map(c => c.valor)).toEqual(linha)
  expect(conferirSaidas(plano.esperado, valores(escrita))).toEqual({ ok: true })
})

test('notas concluem com pendências e contagens sem revelar detalhes brutos', () => {
  const plano = prepararPublicacao(destinos, {
    ...vazias(), validos: ['551126000001'], invalidos: ['551126000002'],
    exportacao: [['', '', 'Empresa', '', '1126000001', '', '', '', 'ChIJ-a']],
    pendencias: [{ linhas: [3, 4], numero: null, motivo: 'detalhe sensível do cenário' }],
    compartilhados: [{ numero: '551126000001', linhas: [2, 5] }], duplicadas: [6],
  }, execucao, grades)
  const escrita = aplicar(aplicar(cenario(), plano.inicio), plano.dados)
  expect(conferirSaidas(plano.esperado, valores(escrita))).toEqual({ ok: true })
  const concluida = aplicar(escrita, plano.conclusao)
  for (const id of [10, 11]) {
    const nota = concluida[id].celulas[0][0].nota
    for (const texto of ['concluído com pendências', 'válidos: 1', 'inválidos: 1', 'exportadas: 1', 'pendências: 1', 'duplicadas: 1', 'compartilhados: 1', execucao.id, execucao.data]) expect(nota).toContain(texto)
    expect(nota).not.toContain('detalhe sensível')
  }
})

test('lote recusado conserva dados e indicação inicial; divergência de leitura impede conclusão', () => {
  const plano = prepararPublicacao(destinos, vazias(), execucao, grades)
  const iniciada = aplicar(cenario(), plano.inicio)
  const falho = [...plano.dados, { updateCells: { range: { sheetId: 11, startRowIndex: 0, endRowIndex: 99, startColumnIndex: 0, endColumnIndex: 9 }, rows: [], fields: 'userEnteredValue' } }]
  const antes = structuredClone(iniciada)
  expect(() => aplicar(iniciada, falho)).toThrow('range fora da grade')
  expect(iniciada).toEqual(antes)
  expect(conferirSaidas(plano.esperado, valores(iniciada))).toEqual({ ok: false, motivo: 'gravacao_incompleta' })
  expect(iniciada[10].celulas[0][0].nota).toContain('em processamento')
  iniciada[11].celulas[5][11].valor = 'coluna extra antiga'
  const escrita = aplicar(iniciada, plano.dados)
  expect(escrita[11].celulas[5][11].valor).toBe('coluna extra antiga')
  expect(conferirSaidas(plano.esperado, valores(escrita))).toEqual({ ok: false, motivo: 'gravacao_incompleta' })
  expect(escrita[11].celulas[0][0].nota).toContain('em processamento')
})

test('confere vazios finais omitidos sem ocultar espaços, tipos errados ou cabeçalhos ausentes', () => {
  const plano = prepararPublicacao(destinos, { ...vazias(), validos: ['551126000001'] }, execucao, grades)
  const lido = { validacao: [['Válidos', 'Inválidos'], ['551126000001']], exportacao: [colunasCrm] }
  expect(conferirSaidas(plano.esperado, lido)).toEqual({ ok: true })
  for (const validacao of [[], [['Válidos', 'Inválidos'], ['551126000001 ']], [['Válidos', 'Inválidos'], [551126000001]], [['Válidos', 'Inválidos'], ['551126000001', null]], [['Válidos', 'Inválidos'], ['551126000001'], ['', '', 'extra']]]) {
    expect(conferirSaidas(plano.esperado, { ...lido, validacao })).toEqual({ ok: false, motivo: 'gravacao_incompleta' })
  }
})

test('rangeA1 escapa apóstrofos e cobre inclusive a coluna AN da grade real', () => {
  expect(rangeA1("Origem d'água", 5001, 40)).toBe("'Origem d''água'!A1:AN5001")
  expect(rangeA1('A', 1, 1)).toBe("'A'!A1:A1")
})

test('recusa destinos iguais e metadados sem dimensões inteiras positivas', () => {
  expect(() => prepararPublicacao({ validacao: 10, exportacao: 10 }, vazias(), execucao, grades)).toThrow(RangeError)
  for (const valor of [0, -1, 1.5, NaN, Infinity]) {
    expect(() => rangeA1('A', valor, 2)).toThrow(RangeError)
    expect(() => rangeA1('A', 2, valor)).toThrow(RangeError)
    expect(() => prepararPublicacao(destinos, vazias(), execucao, { ...grades, validacao: { linhas: valor, colunas: 2 } })).toThrow(RangeError)
    expect(() => prepararPublicacao(destinos, vazias(), execucao, { ...grades, exportacao: { linhas: 2, colunas: valor } })).toThrow(RangeError)
  }
})
