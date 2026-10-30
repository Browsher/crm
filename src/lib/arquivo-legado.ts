import { createHash } from 'node:crypto'

function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return '[' + valor.map(canonico).join(',') + ']'
  if (valor !== null && typeof valor === 'object') return '{' + Object.entries(valor).sort(([a],[b]) => a.localeCompare(b)).map(([chave,v]) => JSON.stringify(chave) + ':' + canonico(v)).join(',') + '}'
  return JSON.stringify(valor)
}
export function assinaturaArquivo(valor: unknown): string {
  return createHash('sha256').update(canonico(valor)).digest('hex')
}
export type ManifestoArquivo = { versao: 1; gruposIds: string[]; empresasIds: string[]; banco: string }
export function validarEscopoArquivo(valor: unknown, ensaioLocal: boolean): { ok: true } | { ok: false; motivo: string } {
  const m = valor as Partial<ManifestoArquivo> | null
  if (!m || m.versao !== 1 || !Array.isArray(m.gruposIds) || !Array.isArray(m.empresasIds) || !m.gruposIds.length || !m.empresasIds.length) return { ok: false, motivo: 'Manifesto vazio ou inválido.' }
  if (!ensaioLocal && (m.gruposIds.length !== 2 || m.empresasIds.length !== 43)) return { ok: false, motivo: 'Esta operação exige exatamente duas listas e 43 empresas.' }
  return { ok: true }
}
