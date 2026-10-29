export type ProgressoGoogle = {
  pedido_id: string
  execucao_id: string
  executor_id: string
  vendedor_id: string
  contrato: 1 | 2
  revisao: number | null
  snapshot_sha256: string | null
  analisadas: number
  entregues: number
  lotes: number
  concluido_em: string | null
  motivo_parada: string | null
  vistas: string[]
  lote_pendente: { id: string; ordinal: number; candidatas: Record<string, unknown>[] } | null
  lotes_confirmados: { id: string; ordinal: number; resposta: { resultado?: string; entregues?: number } | null; origem_sha256: string | null; resultado_sha256: string | null }[]
}