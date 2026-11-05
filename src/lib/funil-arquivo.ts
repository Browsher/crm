import type { ResultadoAtendimento } from './atendimento'

export type ArquivoFunilRecente = {
  empresaId: string
  negociacaoId: string
  nome: string
  arquivadaEm: string
  versao: number
}

export type EstadoAcaoDevolver = Exclude<ResultadoAtendimento, { ok: true }>
  | (Extract<ResultadoAtendimento, { ok: true }> & { aviso?: string })
