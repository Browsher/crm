import { COLUNAS_CRM } from './exportar-crm'
import type { RequestSheets } from './sheets-simples'
import type { ColetaSheets } from './simples-modelo'
import { normalizarNumero } from './telefone'

export type BackupTelefones = { matriz: string[][]; numeros: string[] }
type LeituraBackup = { ok: true; backup: BackupTelefones }
  | { ok: false; motivo: 'backup_invalido' | 'exportacao_anterior_invalida' }

const vazio = (v: unknown) => v === null || v === undefined || typeof v === 'string' && !v.trim()
const legivel = (v: unknown) => vazio(v) || typeof v === 'string' || typeof v === 'number' && Number.isSafeInteger(v)
const matriz = (v: unknown): v is unknown[][] => Array.isArray(v) && v.length > 0 && Array.from(v).every(Array.isArray)

// Mantém inclusive duplicações e vazios intermediários. Deduplicação é somente
// lógica: números já reservados nunca desaparecem da planilha.
export function consolidarBackupTelefones(valores: unknown, anterior: unknown): LeituraBackup {
  if (!matriz(valores) || valores[0][0] !== 'telefone'
    || valores.some(l => l.slice(1).some(v => !vazio(v)))) return { ok: false, motivo: 'backup_invalido' }
  const numeros = new Set<string>()
  const linhas: string[][] = [['telefone']]
  for (const linha of valores.slice(1)) {
    const bruto = linha[0]
    if (!legivel(bruto)) return { ok: false, motivo: 'backup_invalido' }
    if (vazio(bruto)) { linhas.push(['']); continue }
    const normalizado = normalizarNumero(String(bruto))
    if (!normalizado.ok) return { ok: false, motivo: 'backup_invalido' }
    linhas.push([String(bruto)])
    numeros.add(normalizado.numero)
  }
  while (linhas.length > 1 && linhas.at(-1)![0] === '') linhas.pop()
  if (!matriz(anterior) || COLUNAS_CRM.some((h, i) => anterior[0][i] !== h)
    || anterior.some(l => l.slice(COLUNAS_CRM.length).some(v => !vazio(v)))) {
    return { ok: false, motivo: 'exportacao_anterior_invalida' }
  }
  for (const linha of anterior.slice(1)) {
    if (!linha.every(legivel)) return { ok: false, motivo: 'exportacao_anterior_invalida' }
    if (linha.every(vazio)) continue
    const normalizado = normalizarNumero(String(linha[4] ?? ''))
    if (!normalizado.ok) return { ok: false, motivo: 'exportacao_anterior_invalida' }
    if (numeros.has(normalizado.numero)) continue
    linhas.push([normalizado.numero])
    numeros.add(normalizado.numero)
  }
  return { ok: true, backup: { matriz: linhas, numeros: [...numeros] } }
}

export function filtrarColetaPorBackup(coleta: ColetaSheets, numeros: string[]) {
  const historico = new Set(numeros)
  const repetidos = coleta.numeros.filter(n => historico.has(n)).map(numero => ({
    numero, linhas: coleta.linhas.filter(l => l.numero === numero).map(l => l.linha),
  }))
  return {
    coleta: { ...coleta, linhas: coleta.linhas.filter(l => l.numero === null || !historico.has(l.numero)),
      numeros: coleta.numeros.filter(n => !historico.has(n)) },
    repetidos,
  }
}

export function conferirBackup(esperado: string[][], lido: unknown): { ok: true } | { ok: false; motivo: 'backup_alterado' } {
  if (!matriz(lido)) return { ok: false, motivo: 'backup_alterado' }
  for (let i = 0; i < Math.max(esperado.length, lido.length); i++) {
    const e = esperado[i] ?? []
    const l = lido[i] ?? []
    for (let c = 0; c < Math.max(e.length, l.length); c++) {
      if ((e[c] ?? '') !== (l[c] ?? '')) return { ok: false, motivo: 'backup_alterado' }
    }
  }
  return { ok: true }
}

export function prepararAcrescimoBackup(
  sheetId: number, anterior: string[][], novo: string[][], grade: { linhas: number; colunas: number },
): RequestSheets[] {
  if (!Number.isSafeInteger(sheetId) || sheetId < 0 || !Number.isSafeInteger(grade.linhas) || grade.linhas < 1
    || !Number.isSafeInteger(grade.colunas) || grade.colunas < 1
    || novo.length < anterior.length || !conferirBackup(anterior, novo.slice(0, anterior.length)).ok) {
    throw new RangeError('Acréscimo de backup inválido')
  }
  const requests: RequestSheets[] = []
  // Somente acréscimos: uma edição após a última releitura nunca pode ser
  // sobrescrita por índice nem perder linhas por redução de uma grade antiga.
  // https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#appendcellsrequest
  if (novo.length > grade.linhas) requests.push({ appendDimension: {
    sheetId, dimension: 'ROWS', length: novo.length - grade.linhas,
  } })
  requests.push({ repeatCell: {
    range: { sheetId, startColumnIndex: 0, endColumnIndex: 1 },
    cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } }, fields: 'userEnteredFormat.numberFormat',
  } })
  if (novo.length > anterior.length) requests.push({ appendCells: {
    sheetId,
    rows: novo.slice(anterior.length).map(linha => ({ values: [{ userEnteredValue: { stringValue: linha[0] } }] })),
    fields: 'userEnteredValue',
  } })
  return requests
}
