import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { createRequire } from 'node:module'
import { describe, expect, test, vi } from 'vitest'
import { montarModelo } from './modelo'
import { CABECALHO, CABECALHO_LEGADO, type Analise } from './planilha'
import { analisarArquivo } from './arquivo'

function ok(a: Analise) {
  if (!a.ok) throw new Error(`esperava ok, veio ${a.falha.motivo}`)
  return a
}

async function montarXlsx(
  linhas: ExcelJS.CellValue[][],
  outrasAbas: ExcelJS.CellValue[][][] = [],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.addWorksheet('empresas').addRows(linhas)
  for (const [indice, dados] of outrasAbas.entries()) workbook.addWorksheet(`outra-${indice + 1}`).addRows(dados)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

const CABECALHO_CELULAS = CABECALHO.split(',')
const AURORA = ['11222333000181', 'Aurora Comercio LTDA', 'Aurora', 'Jose', '11987654321', 'contato@aurora.com.br', '01310100', '4742300']
const require = createRequire(import.meta.url)

describe('analisarArquivo: XLSX', () => {
  test('aceita diretamente o modelo real gerado e preserva os zeros', async () => {
    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: montarModelo() }))

    expect(a.aceitas).toEqual([
      expect.objectContaining({
        linha: 2,
        cnpj: '11222333000181',
        cep: '01310100',
        cnaePrincipal: '4742300',
      }),
    ])
  })

  test('aplica mascaras numericas usuais para conservar zeros de CNPJ, CEP e CNAE', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    const linha = planilha.addRow([11222333000181, 'Aurora Comercio LTDA', '', '', 11987654321, '', 1310100, 111301])
    linha.getCell(1).numFmt = '00.000.000/0000-00'
    linha.getCell(7).numFmt = '00000-000'
    linha.getCell(8).numFmt = '0000-0/00'

    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) }))

    expect(a.aceitas[0]).toMatchObject({ cnpj: '11222333000181', cep: '01310100', cnaePrincipal: '0111301' })
  })

  test('nao inventa zero para numero sem mascara', async () => {
    const linhas: ExcelJS.CellValue[][] = [CABECALHO_CELULAS, [...AURORA]]
    linhas[1][6] = 1310100
    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx(linhas) }))
    expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 2, motivo: 'cep_curto', valor: '1310100' }])
  })

  test('preserva mascara numerica herdada da coluna', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.getColumn(7).numFmt = '00000-000'
    planilha.addRow(CABECALHO_CELULAS)
    planilha.addRow([...AURORA.slice(0, 6), 1310100, AURORA[7]])

    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) }))
    expect(a.aceitas[0]).toMatchObject({ cep: '01310100' })
  })

  test('nao expande mascara numerica fora do limite', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    const linha = planilha.addRow([...AURORA.slice(0, 6), 1310100, AURORA[7]])
    linha.getCell(7).numFmt = '0'.repeat(65)

    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) }))
    expect(a.recusadas[0]).toMatchObject({ tipo: 'campo', motivo: 'cep_curto', valor: '1310100' })
  })

  test('mantem o numero original depois de uma linha vazia', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    planilha.addRow(AURORA)
    planilha.getRow(4).values = ['11222333000182', 'Erro LTDA', '', '', '1134567890', '', '', '']

    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) }))

    expect(a.aceitas.map((linha) => linha.linha)).toEqual([2])
    expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 4, motivo: 'cnpj_dv', valor: '11222333000182' }])
  })

  test('recusa formula mesmo quando ela traz resultado calculado', async () => {
    const linhas: ExcelJS.CellValue[][] = [CABECALHO_CELULAS, [...AURORA]]
    linhas[1][1] = { formula: '"Aurora Comercio LTDA"', result: 'Aurora Comercio LTDA' }

    expect(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx(linhas) })).toEqual({
      ok: false,
      falha: { motivo: 'formula_nao_permitida', linha: 2, coluna: 'razao_social' },
    })
  })

  test('recusa formula sem resultado calculado mesmo quando e a unica celula da linha', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    planilha.getCell('H2').value = { formula: '1+1' }

    expect(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) })).toEqual({
      ok: false,
      falha: { motivo: 'formula_nao_permitida', linha: 2, coluna: 'cnae_principal' },
    })
  })

  test('linha esparsa conserva o numero original sem materializar as linhas vazias', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    planilha.getRow(100_000).values = ['11222333000182', 'Erro LTDA', '', '', '1134567890', '', '', '']

    const a = ok(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) }))
    expect(a.recusadas).toEqual([{ tipo: 'campo', linha: 100_000, motivo: 'cnpj_dv', valor: '11222333000182' }])
  })

  test('recusa arquivo corrompido como erro recuperavel', async () => {
    expect(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) })).toEqual({
      ok: false,
      falha: { motivo: 'xlsx_corrompido' },
    })
  })

  test('recusa duas planilhas com dados em vez de escolher uma', async () => {
    const linhas = [CABECALHO_CELULAS, AURORA]
    expect(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx(linhas, [linhas]) })).toEqual({
      ok: false,
      falha: { motivo: 'planilhas_ambiguas' },
    })
  })

  test('recusa mais de 5000 linhas de empresas', async () => {
    const linhas = [CABECALHO_CELULAS, ...Array.from({ length: 5001 }, () => AURORA)]
    expect(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx(linhas) })).toEqual({
      ok: false,
      falha: { motivo: 'excede_limite', linhas: 5001 },
    })
  })

  test('recusa workbook que expande alem do limite antes de carrega-lo', async () => {
    const enorme = 'A'.repeat(17 * 1024 * 1024)
    const bytes = await montarXlsx([[enorme]])
    expect(bytes.byteLength).toBeLessThan(1_500_000)

    expect(await analisarArquivo({ formato: 'xlsx', bytes })).toEqual({
      ok: false,
      falha: { motivo: 'excede_tamanho' },
    })
  }, 20_000)

  test('nao materializa as celulas de um merge gigante', async () => {
    const zip = await JSZip.loadAsync(await montarXlsx([CABECALHO_CELULAS, AURORA]))
    const caminho = 'xl/worksheets/sheet1.xml'
    const planilha = zip.file(caminho)
    if (planilha === null) throw new Error('fixture sem sheet1.xml')
    const xml = await planilha.async('string')
    zip.file(caminho, xml.replace('</sheetData>', '</sheetData><mergeCells count="1"><mergeCell ref="A3:XFD1048576"/></mergeCells>'))
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    const workbook = new ExcelJS.Workbook()
    const prototipo = Object.getPrototypeOf(workbook.addWorksheet('controle')) as { _mergeCellsInternal: () => void }
    const expandir = vi.spyOn(prototipo, '_mergeCellsInternal').mockImplementation(() => {
      throw new Error('merge tentou materializar a faixa')
    })
    try {
      const a = ok(await analisarArquivo({ formato: 'xlsx', bytes }))
      expect(a.aceitas).toHaveLength(1)
      expect(expandir).not.toHaveBeenCalled()
    } finally {
      expandir.mockRestore()
    }
  })

  test('recusa faixa de colunas fora do limite antes de o ExcelJS expandi-la', async () => {
    const zip = await JSZip.loadAsync(await montarXlsx([CABECALHO_CELULAS, AURORA]))
    const caminho = 'xl/worksheets/sheet1.xml'
    const planilha = zip.file(caminho)
    if (planilha === null) throw new Error('fixture sem sheet1.xml')
    const xml = await planilha.async('string')
    zip.file(caminho, xml.replace('<sheetData>', '<cols><col min="1" max="1000000000" width="10"/></cols><sheetData>'))
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    const Column = require('exceljs/lib/doc/column') as {
      fromModel: (worksheet: unknown, cols?: { max: number }[]) => unknown
    }
    const original = Column.fromModel
    const expandir = vi.spyOn(Column, 'fromModel').mockImplementation((worksheet, cols) => {
      if (cols?.some((coluna) => coluna.max > 16_384)) throw new Error('colunas tentaram expandir a faixa')
      return original(worksheet, cols)
    })
    try {
      expect(await analisarArquivo({ formato: 'xlsx', bytes })).toEqual({
        ok: false,
        falha: { motivo: 'excede_tamanho' },
      })
      expect(expandir).not.toHaveBeenCalled()
    } finally {
      expandir.mockRestore()
    }
  })

  test('recusa nomes definidos antes de o ExcelJS expandir a faixa', async () => {
    const zip = await JSZip.loadAsync(await montarXlsx([CABECALHO_CELULAS, AURORA]))
    const caminho = 'xl/workbook.xml'
    const workbook = zip.file(caminho)
    if (workbook === null) throw new Error('fixture sem workbook.xml')
    const xml = await workbook.async('string')
    zip.file(
      caminho,
      xml.replace(
        '</workbook>',
        '<definedNames><definedName name="faixa">empresas!$A$1:$XFD$1048576</definedName></definedNames></workbook>',
      ),
    )

    expect(await analisarArquivo({ formato: 'xlsx', bytes: await zip.generateAsync({ type: 'uint8array' }) })).toEqual({
      ok: false,
      falha: { motivo: 'estrutura_nao_suportada' },
    })
  })

  test('recusa linha com celulas demais durante a guarda estrutural', async () => {
    const linhaLarga = [...AURORA, ...Array.from({ length: 9 }, () => 'extra')]

    expect(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx([CABECALHO_CELULAS, linhaLarga]) })).toEqual({
      ok: false,
      falha: { motivo: 'excede_tamanho' },
    })
  })

  test('recusa celula em indice de coluna distante antes do load', async () => {
    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('empresas')
    planilha.addRow(CABECALHO_CELULAS)
    planilha.addRow(AURORA)
    planilha.getCell('XFD2').value = 'extra'

    expect(await analisarArquivo({ formato: 'xlsx', bytes: new Uint8Array(await workbook.xlsx.writeBuffer()) })).toEqual({
      ok: false,
      falha: { motivo: 'excede_tamanho' },
    })
  })

  test('aplica o limite estrutural ao conjunto de planilhas', async () => {
    const linhas = [CABECALHO_CELULAS, ...Array.from({ length: 2550 }, () => AURORA)]

    expect(await analisarArquivo({ formato: 'xlsx', bytes: await montarXlsx(linhas, [linhas]) })).toEqual({
      ok: false,
      falha: { motivo: 'excede_tamanho' },
    })
  })
})

describe('analisarArquivo: compatibilidade CSV', () => {
  test('mantem o chamador legado que passa somente bytes', async () => {
    const csv = new TextEncoder().encode(`${CABECALHO_LEGADO}\n${AURORA.slice(0, 7).join(',')}`)
    const a = ok(await analisarArquivo(csv))
    expect(a.aceitas[0]).toMatchObject({ cnpj: '11222333000181', cep: '01310100' })
  })
})
