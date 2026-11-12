import type { ESTADOS_BR } from './banco-empresas'

export const LIMITE_DESCRICAO_IA = 600

export type RegiaoAssistente = { estado: string; cidade: string; bairros: string[] }
export type EntradaAssistente = {
  produto: { sku: string } | { descricao: string }
  publico?: string
  especialidade?: string
  detalhes?: string
  regioes?: RegiaoAssistente[]
}

export type RegiaoSugerida = {
  cidade: string
  uf: typeof ESTADOS_BR[number]
  bairro?: string
}

export type PublicoSugerido = { titulo: string; descricao: string }
export type SugestoesBusca<T extends PublicoSugerido> = { sugestoes: T[]; regiao?: RegiaoSugerida }
export type ResultadoAssistente<T extends PublicoSugerido> =
  | { ok: true; valor: SugestoesBusca<T> }
  | { ok: false; motivo: string }
