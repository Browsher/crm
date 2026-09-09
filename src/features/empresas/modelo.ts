import { CABECALHO } from './planilha'

// Monta o .xlsx do modelo de importação, sem dependência nenhuma.
//
// Um .xlsx é um zip de XMLs. O que importa neste arquivo é UMA coisa: as sete
// colunas nascerem formatadas como Texto, para o Excel não comer o zero à
// esquerda do CEP nem transformar o CNPJ em notação científica quando alguém
// digitar as próximas linhas. Isso é o `style="1"` no <col>, apontando para um
// <xf> com numFmtId="49", que é o formato Texto embutido do OOXML.
//
// Gerar em vez de fazer à mão no Excel tem um preço declarado: gerador erra
// formatação em silêncio. O que compensa é o teste comparar o arquivo
// versionado com o que este código produz, mais a verificação manual de abrir
// no Excel — registrada em docs/db/divida-tecnica.md.

const EXEMPLO = [
  '11222333000181',
  'Aurora Comercio LTDA',
  'Aurora Iluminacao',
  'Jose da Silva',
  '11987654321',
  'contato@aurora.com.br',
  '01310100',
]

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const coluna = (i: number) => String.fromCharCode(65 + i)

function linha(numero: number, valores: string[], estilo: number): string {
  const celulas = valores
    .map((v, i) => `<c r="${coluna(i)}${numero}" s="${estilo}" t="inlineStr"><is><t>${escapar(v)}</t></is></c>`)
    .join('')
  return `<row r="${numero}">${celulas}</row>`
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const PARTES: [string, string][] = [
  [
    '[Content_Types].xml',
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
  ],
  [
    '_rels/.rels',
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  ],
  [
    'xl/workbook.xml',
    `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}">` +
      '<sheets><sheet name="empresas" sheetId="1" r:id="rId1"/></sheets></workbook>',
  ],
  [
    'xl/_rels/workbook.xml.rels',
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
  ],
  [
    'xl/styles.xml',
    // numFmtId="49" é o formato Texto embutido. O xf 1 é Texto; o 2 é Texto em
    // negrito, para o cabeçalho. Sem applyNumberFormat="1" o Excel ignora.
    `${XML}<styleSheet xmlns="${NS}">` +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
      '</cellXfs></styleSheet>',
  ],
  [
    'xl/worksheets/sheet1.xml',
    // style="1" no <col> é o que faz a COLUNA INTEIRA ser Texto, e não só as
    // células já preenchidas. É disso que depende a linha 3 em diante, digitada
    // pelo gestor, manter o zero à esquerda do CEP.
    `${XML}<worksheet xmlns="${NS}">` +
      '<cols><col min="1" max="7" width="22" style="1" customWidth="1"/></cols><sheetData>' +
      linha(1, CABECALHO.split(','), 2) +
      linha(2, EXEMPLO, 1) +
      '</sheetData></worksheet>',
  ],
]

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(dados: Buffer): number {
  let c = 0xffffffff
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Zip pelo método "stored": sem compressão, sem zlib, sem dependência.
//
// Determinístico de propósito — data fixa em 1980-01-01 e nenhuma compressão,
// então o mesmo código produz sempre os mesmos bytes. É isso que permite ao
// teste comparar o arquivo versionado com o que o gerador produz hoje, em vez
// de só conferir que ele começa com "PK".
export function montarModelo(): Buffer {
  const locais: Buffer[] = []
  const centrais: Buffer[] = []
  let deslocamento = 0

  for (const [nome, conteudo] of PARTES) {
    const bytesNome = Buffer.from(nome, 'utf8')
    const bytesDados = Buffer.from(conteudo, 'utf8')
    const crc = crc32(bytesDados)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versão mínima
    local.writeUInt16LE(0, 6) // sem flags
    local.writeUInt16LE(0, 8) // método 0 = stored
    local.writeUInt16LE(0, 10) // hora
    local.writeUInt16LE(0x21, 12) // data: 1980-01-01
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(bytesDados.length, 18)
    local.writeUInt32LE(bytesDados.length, 22)
    local.writeUInt16LE(bytesNome.length, 26)
    local.writeUInt16LE(0, 28)
    locais.push(local, bytesNome, bytesDados)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(bytesDados.length, 20)
    central.writeUInt32LE(bytesDados.length, 24)
    central.writeUInt16LE(bytesNome.length, 28)
    central.writeUInt32LE(deslocamento, 42)
    centrais.push(central, bytesNome)

    deslocamento += 30 + bytesNome.length + bytesDados.length
  }

  const corpo = Buffer.concat(locais)
  const diretorio = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(PARTES.length, 8)
  fim.writeUInt16LE(PARTES.length, 10)
  fim.writeUInt32LE(diretorio.length, 12)
  fim.writeUInt32LE(corpo.length, 16)

  return Buffer.concat([corpo, diretorio, fim])
}
