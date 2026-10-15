export type PendenciaSimples = {
  linhas: number[]
  numero: string | null
  motivo: string
}

export type LinhaScraping = {
  linha: number
  dados: Record<string, string>
  numero: string | null
}

export type ColetaSheets = {
  linhas: LinhaScraping[]
  numeros: string[]
  pendencias: PendenciaSimples[]
}

export type LeituraSheets =
  | { ok: true; coleta: ColetaSheets }
  | { ok: false; motivo: 'estrutura_invalida' | 'excede_limite'; detalhes: string[] }

export type SaidasSimples = {
  validos: string[]
  invalidos: string[]
  exportacao: string[][]
  pendencias: PendenciaSimples[]
  compartilhados: { numero: string; linhas: number[] }[]
  duplicadas: number[]
}

export type ResultadoSimples =
  | { ok: true; saidas: SaidasSimples }
  | { ok: false; motivo: 'consulta_incompleta'; pendencias: PendenciaSimples[] }
