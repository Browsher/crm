export type EventoHistoricoComercial = {
  id: string
  natureza: 'contato' | 'atividade_sem_ligacao' | 'venda'
  titulo: string
  criadoEm: string
  autor: string | null
  nota: string | null
  resultado?: string
  proximoPasso?: { descricao: string; data: string | null }
  venda?: { centavos: string; data: string }
  empresa?: string
}

export type FiltroHistoricoComercial = 'todos' | 'atendimentos' | 'vendas'

export function filtrarEventosHistorico(eventos: readonly EventoHistoricoComercial[], filtro: FiltroHistoricoComercial): EventoHistoricoComercial[] {
  return eventos.filter(evento => filtro === 'todos' || (filtro === 'vendas' ? evento.natureza === 'venda' : evento.natureza !== 'venda'))
}
