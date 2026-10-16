import { COLUNAS_CRM } from './exportar-crm'
import type { SaidasSimples } from './simples-modelo'

export type DestinosSimples = { validacao: number; exportacao: number }
export type ExecucaoSimples = { id: string; data: string }
export type GradesSimples = {
  validacao: { linhas: number; colunas: number }
  exportacao: { linhas: number; colunas: number }
}
export type RequestSheets = Record<string, unknown>
export type PlanoSheets = {
  inicio: RequestSheets[]
  dados: RequestSheets[]
  conclusao: RequestSheets[]
  esperado: { validacao: string[][]; exportacao: string[][] }
}
export type ConferenciaSheets =
  | { ok: true }
  | { ok: false; motivo: 'gravacao_incompleta' }

function conferirDimensao(valor: number): void {
  if (!Number.isSafeInteger(valor) || valor < 1) throw new RangeError('Dimensão de grade inválida')
}

export function rangeA1(titulo: string, linhas: number, colunas: number): string {
  conferirDimensao(linhas)
  conferirDimensao(colunas)
  let coluna = ''
  for (let indice = colunas; indice > 0; indice = Math.floor((indice - 1) / 26)) {
    coluna = String.fromCharCode(65 + (indice - 1) % 26) + coluna
  }
  return "'" + titulo.replace(/'/g, "''") + "'!A1:" + coluna + linhas
}

// Contratos documentados: GridRange usa índices zero-based e fim exclusivo;
// ausência de endRowIndex abrange as linhas restantes da grade.
// https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other#GridRange
// repeatCell/updateCells usam fields relativos a CellData; stringValue nunca
// interpreta fórmulas. updateSheetProperties usa máscara relativa a SheetProperties.
// https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request
function notas(sheetId: number, colunas: number, note: string): RequestSheets {
  return {
    updateCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colunas },
      rows: [{ values: Array.from({ length: colunas }, () => ({ note })) }],
      fields: 'note',
    },
  }
}

function limpar(sheetId: number, colunas: number): RequestSheets {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: colunas },
      cell: {},
      fields: 'userEnteredValue',
    },
  }
}

function escrever(sheetId: number, matriz: string[][]): RequestSheets {
  return {
    updateCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: matriz.length, startColumnIndex: 0, endColumnIndex: matriz[0].length },
      rows: matriz.map(linha => ({ values: linha.map(stringValue => ({ userEnteredValue: { stringValue } })) })),
      fields: 'userEnteredValue',
    },
  }
}

export function prepararPublicacao(
  destinos: DestinosSimples, saidas: SaidasSimples,
  execucao: ExecucaoSimples, grades: GradesSimples,
): PlanoSheets {
  if (destinos.validacao === destinos.exportacao) throw new RangeError('Destinos precisam ser distintos')
  for (const grade of [grades.validacao, grades.exportacao]) {
    conferirDimensao(grade.linhas)
    conferirDimensao(grade.colunas)
  }
  const esperado = {
    validacao: [
      ['Válidos', 'Inválidos'],
      ...Array.from({ length: Math.max(saidas.validos.length, saidas.invalidos.length) }, (_, indice) => [
        saidas.validos[indice] ?? '', saidas.invalidos[indice] ?? '',
      ]),
    ],
    exportacao: [[...COLUNAS_CRM], ...saidas.exportacao.map(linha => [...linha])],
  }
  const identificacao = 'Execução: ' + execucao.id + '\nData: ' + execucao.data
  const contagens = '\nválidos: ' + saidas.validos.length + '\ninválidos: ' + saidas.invalidos.length
    + '\nexportadas: ' + saidas.exportacao.length + '\npendências: ' + saidas.pendencias.length
    + '\nduplicadas: ' + saidas.duplicadas.length + '\ncompartilhados: ' + saidas.compartilhados.length
  const situacao = saidas.pendencias.length ? 'concluído com pendências' : 'concluído'
  const inicio: RequestSheets[] = []
  const expansoes: RequestSheets[] = []
  const limpezas: RequestSheets[] = []
  const escritas: RequestSheets[] = []
  const conclusao: RequestSheets[] = []
  for (const destino of ['validacao', 'exportacao'] as const) {
    const sheetId = destinos[destino]
    const grade = grades[destino]
    const matriz = esperado[destino]
    const colunas = matriz[0].length
    // Somente cabeçalhos já existentes podem receber a nota antes da expansão.
    inicio.push(notas(sheetId, Math.min(colunas, grade.colunas), identificacao + '\nSituação: em processamento' + contagens))
    const rowCount = Math.max(grade.linhas, matriz.length)
    const columnCount = Math.max(grade.colunas, colunas)
    if (rowCount !== grade.linhas || columnCount !== grade.colunas) {
      expansoes.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { rowCount, columnCount } },
          fields: 'gridProperties.rowCount,gridProperties.columnCount',
        },
      })
    }
    limpezas.push(limpar(sheetId, colunas))
    escritas.push(escrever(sheetId, matriz))
    conclusao.push(notas(sheetId, colunas, identificacao + '\nSituação: ' + situacao + contagens))
  }
  // Um único batchUpdate para dados: expansões, limpeza e escrita são atômicas.
  // O consumidor envia conclusao apenas depois de conferirSaidas retornar ok.
  return { inicio, dados: [...expansoes, ...limpezas, ...escritas], conclusao, esperado }
}

export function conferirSaidas(
  esperado: PlanoSheets['esperado'],
  lido: { validacao: unknown[][]; exportacao: unknown[][] },
): ConferenciaSheets {
  for (const destino of ['validacao', 'exportacao'] as const) {
    const matrizEsperada = esperado[destino]
    const matrizLida = lido[destino]
    for (let l = 0; l < Math.max(matrizEsperada.length, matrizLida.length); l++) {
      const linhaEsperada = matrizEsperada[l] ?? []
      const linhaLida = matrizLida[l] ?? []
      for (let c = 0; c < Math.max(linhaEsperada.length, linhaLida.length); c++) {
        const valorEsperado = c < linhaEsperada.length ? linhaEsperada[c] : ''
        const valorLido = c < linhaLida.length ? linhaLida[c] : ''
        if (valorEsperado !== valorLido) return { ok: false, motivo: 'gravacao_incompleta' }
      }
    }
  }
  return { ok: true }
}
