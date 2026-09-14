import { StringDecoder } from 'node:string_decoder'
import ExcelJS from 'exceljs'
import { SaxesParser } from 'saxes'
import { fromBufferPromise } from 'yauzl'
import {
  analisarLinhas,
  analisarPlanilha,
  CABECALHO,
  CABECALHO_LEGADO,
  LIMITE_DE_LINHAS,
  type Analise,
  type FalhaDeArquivo,
  type LinhaBruta,
} from './planilha'

export const LIMITE_BYTES_ARQUIVO = 1_500_000
const LIMITE_BYTES_DESCOMPACTADOS = 16 * 1024 * 1024
const LIMITE_ENTRADAS_XLSX = 100
const MAXIMO_COLUNAS_EXCEL = 16_384
const MAXIMO_LINHAS_EXCEL = 1_048_576
const MAXIMO_FAIXAS_DE_COLUNA = 64
const MAXIMO_LINHAS_NO_XML = LIMITE_DE_LINHAS + 100
const MAXIMO_CELULAS_POR_LINHA = 16
const MAXIMO_CELULAS_NO_XML = MAXIMO_LINHAS_NO_XML * MAXIMO_CELULAS_POR_LINHA
const MAXIMO_CARACTERES_NUM_FMT = 64

type EstadoEstrutural = 'ok' | 'grande' | 'corrompido' | 'nao_suportada'
type OrcamentoEstrutural = { linhas: number; celulas: number }

export type FormatoArquivo = 'csv' | 'xlsx'
export type ArquivoEmpresas = { formato: FormatoArquivo; bytes: Uint8Array }
export type FonteEmpresas = Uint8Array | ArquivoEmpresas

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function formatoDoArquivo(nome: string, tipo: string): FormatoArquivo | null {
  const minusculo = nome.toLowerCase()
  if (minusculo.endsWith('.xlsx') || tipo === TIPO_XLSX) return 'xlsx'
  if (minusculo.endsWith('.csv') || tipo === 'text/csv' || tipo === 'application/csv') return 'csv'
  return null
}

function falha(falha: FalhaDeArquivo): Analise {
  return { ok: false, falha }
}

function colunaDoEndereco(endereco: string): number | null {
  const correspondencia = /^([A-Z]+)([1-9][0-9]*)$/i.exec(endereco)
  if (correspondencia === null) return null
  let coluna = 0
  for (const caractere of correspondencia[1].toUpperCase()) {
    coluna = coluna * 26 + caractere.charCodeAt(0) - 64
    if (coluna > MAXIMO_COLUNAS_EXCEL) return null
  }
  const linha = Number(correspondencia[2])
  if (!Number.isSafeInteger(linha) || linha > MAXIMO_LINHAS_EXCEL) return null
  return coluna
}

function fiscalDaEstruturaDaPlanilha(orcamento: OrcamentoEstrutural) {
  let faixasDeColuna = 0
  let celulasNaLinha = 0
  let estado: EstadoEstrutural = 'ok'
  const parser = new SaxesParser()
  parser.on('opentag', (tag) => {
    const nome = tag.name.split(':').at(-1)
    if (nome === 'row') {
      orcamento.linhas += 1
      celulasNaLinha = 0
      const numero = Number(tag.attributes.r)
      if (!Number.isSafeInteger(numero) || numero < 1 || numero > MAXIMO_LINHAS_EXCEL) estado = 'corrompido'
      if (orcamento.linhas > MAXIMO_LINHAS_NO_XML) estado = 'grande'
      return
    }
    if (nome === 'c') {
      celulasNaLinha += 1
      orcamento.celulas += 1
      const endereco = String(tag.attributes.r ?? '')
      const coluna = colunaDoEndereco(endereco)
      if (coluna === null) estado = 'corrompido'
      else if (coluna > MAXIMO_CELULAS_POR_LINHA) estado = 'grande'
      if (celulasNaLinha > MAXIMO_CELULAS_POR_LINHA || orcamento.celulas > MAXIMO_CELULAS_NO_XML) estado = 'grande'
      return
    }
    if (nome === 'col') {
      faixasDeColuna += 1
      const minimo = Number(tag.attributes.min)
      const maximo = Number(tag.attributes.max)
      if (!Number.isInteger(minimo) || !Number.isInteger(maximo) || minimo < 1 || maximo < minimo) {
        estado = 'corrompido'
        return
      }
      if (faixasDeColuna > MAXIMO_FAIXAS_DE_COLUNA || maximo > MAXIMO_COLUNAS_EXCEL) estado = 'grande'
    }
  })
  return {
    parser,
    estado: () => estado,
  }
}

function fiscalDosNomesDefinidos() {
  let estado: EstadoEstrutural = 'ok'
  const parser = new SaxesParser()
  parser.on('opentag', (tag) => {
    if (tag.name.split(':').at(-1) === 'definedName') estado = 'nao_suportada'
  })
  return {
    parser,
    estado: () => estado,
  }
}

async function xlsxDentroDosLimites(bytes: Uint8Array): Promise<EstadoEstrutural> {
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const zip = await fromBufferPromise(buffer, { validateEntrySizes: true, strictFileNames: true })
    let entradas = 0
    let declarados = 0
    let lidos = 0
    const orcamento: OrcamentoEstrutural = { linhas: 0, celulas: 0 }

    for await (const entrada of zip.eachEntry()) {
      entradas += 1
      declarados += entrada.uncompressedSize
      if (entradas > LIMITE_ENTRADAS_XLSX || declarados > LIMITE_BYTES_DESCOMPACTADOS) return 'grande'
      if (entrada.fileName.endsWith('/')) continue

      const stream = await zip.openReadStreamPromise(entrada)
      const fiscal = /^xl\/worksheets\/[^/]+[.]xml$/.test(entrada.fileName)
        ? fiscalDaEstruturaDaPlanilha(orcamento)
        : entrada.fileName === 'xl/workbook.xml'
          ? fiscalDosNomesDefinidos()
          : null
      const decoder = fiscal === null ? null : new StringDecoder('utf8')
      for await (const trecho of stream) {
        const bufferTrecho = Buffer.isBuffer(trecho) ? trecho : Buffer.from(trecho)
        lidos += bufferTrecho.length
        if (lidos > LIMITE_BYTES_DESCOMPACTADOS) {
          stream.destroy()
          return 'grande'
        }
        if (fiscal !== null && decoder !== null) {
          fiscal.parser.write(decoder.write(bufferTrecho))
          if (fiscal.estado() !== 'ok') {
            stream.destroy()
            return fiscal.estado()
          }
        }
      }
      if (fiscal !== null && decoder !== null) {
        fiscal.parser.write(decoder.end()).close()
        if (fiscal.estado() !== 'ok') return fiscal.estado()
      }
    }
    return 'ok'
  } catch {
    return 'corrompido'
  }
}

function ultimaColunaComConteudo(linha: ExcelJS.Row): number {
  let ultima = 0
  linha.eachCell({ includeEmpty: false }, (celula, coluna) => {
    if (celula.value !== null && celula.text !== '') ultima = coluna
  })
  return ultima
}

function textoDaCelula(celula: ExcelJS.Cell): string {
  if (typeof celula.value === 'number' && Number.isSafeInteger(celula.value) && celula.value >= 0) {
    const formato = celula.numFmt
    if (typeof formato !== 'string' || formato.length > MAXIMO_CARACTERES_NUM_FMT) return celula.text
    const mascara = formato.replace(/\\(.)/g, '$1').replace(/"([^"]*)"/g, '$1')
    if (/^[0 .()/\-]+$/.test(mascara)) {
      const casas = mascara.match(/0/g)?.length ?? 0
      const digitos = String(celula.value)
      if (casas > 0 && digitos.length <= casas) {
        let indice = 0
        const preenchido = digitos.padStart(casas, '0')
        return mascara.replace(/0/g, () => preenchido[indice++])
      }
    }
  }
  return celula.text
}

function camposDaLinha(linha: ExcelJS.Row, minimo = 0): string[] {
  const quantidade = Math.max(ultimaColunaComConteudo(linha), minimo)
  return Array.from({ length: quantidade }, (_, indice) => textoDaCelula(linha.getCell(indice + 1)))
}

function colunaDaFormula(cabecalho: string[], celula: ExcelJS.Cell): string {
  return cabecalho[celula.fullAddress.col - 1] || celula.address
}

function primeiraFormula(linha: ExcelJS.Row): ExcelJS.Cell | undefined {
  let encontrada: ExcelJS.Cell | undefined
  linha.eachCell({ includeEmpty: false }, (celula) => {
    if (encontrada === undefined && celula.type === ExcelJS.ValueType.Formula) encontrada = celula
  })
  return encontrada
}

function lerLinhas(planilha: ExcelJS.Worksheet): Analise | LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  let cabecalho: string[] = []
  let dados = 0
  let erro: Analise | null = null

  planilha.eachRow((linha) => {
    if (erro !== null) return
    const numero = linha.number
    const ultima = ultimaColunaComConteudo(linha)

    if (linhas.length === 0) {
      if (ultima === 0) return
      cabecalho = camposDaLinha(linha)
      linhas.push({ numero, campos: cabecalho })
      return
    }

    // Fórmula sem resultado em cache tem texto vazio. Ela precisa ser
    // identificada antes de decidir se a linha está vazia.
    const formula = primeiraFormula(linha)
    if (formula !== undefined) {
      erro = falha({
        motivo: 'formula_nao_permitida',
        linha: numero,
        coluna: colunaDaFormula(cabecalho, formula),
      })
      return
    }
    if (ultima === 0) return

    dados += 1
    if (dados > LIMITE_DE_LINHAS) {
      erro = falha({ motivo: 'excede_limite', linhas: dados })
      return
    }

    const esperado = cabecalho.join(',') === CABECALHO ? 8 : cabecalho.join(',') === CABECALHO_LEGADO ? 7 : 0
    linhas.push({ numero, campos: camposDaLinha(linha, esperado) })
  })

  return erro ?? linhas
}

async function analisarXlsx(bytes: Uint8Array): Promise<Analise> {
  const limite = await xlsxDentroDosLimites(bytes)
  if (limite === 'grande') return falha({ motivo: 'excede_tamanho' })
  if (limite === 'corrompido') return falha({ motivo: 'xlsx_corrompido' })
  if (limite === 'nao_suportada') return falha({ motivo: 'estrutura_nao_suportada' })

  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const workbook = new ExcelJS.Workbook()
  try {
    // ExcelJS 4 tipa Buffer com uma versão antiga de @types/node. O valor é o
    // Buffer nativo; a conversão atravessa somente essa divergência de tipos.
    const dados = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
    await workbook.xlsx.load(dados, { ignoreNodes: ['mergeCells', 'dataValidations'] })
  } catch {
    return falha({ motivo: 'xlsx_corrompido' })
  }

  const planilhasComDados = workbook.worksheets.filter((planilha) => planilha.actualRowCount > 0)
  if (planilhasComDados.length === 0) return falha({ motivo: 'vazio' })
  if (planilhasComDados.length > 1) return falha({ motivo: 'planilhas_ambiguas' })
  const linhas = lerLinhas(planilhasComDados[0])
  return Array.isArray(linhas) ? analisarLinhas(linhas) : linhas
}

export async function analisarArquivo(fonte: FonteEmpresas): Promise<Analise> {
  const arquivo: ArquivoEmpresas = fonte instanceof Uint8Array ? { formato: 'csv', bytes: fonte } : fonte
  if (arquivo.bytes.byteLength > LIMITE_BYTES_ARQUIVO) return falha({ motivo: 'excede_tamanho' })
  if (arquivo.formato === 'csv') return analisarPlanilha(arquivo.bytes)
  return analisarXlsx(arquivo.bytes)
}
