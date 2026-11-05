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
