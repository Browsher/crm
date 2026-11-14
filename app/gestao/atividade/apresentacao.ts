import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import type { PaginaAtividade } from '@/src/lib/atividade-gestao'

export function apresentarAtividade(pagina: PaginaAtividade | null): PaginaAtividade | null {
  if (!pagina) return null
  return { ...pagina, eventos: pagina.eventos.map(evento => {
    if (evento.categoria !== 'banco' || !evento.dados.motivo) return evento
    return { ...evento, dados: { ...evento.dados, motivo: mensagemBusca(evento.dados.motivo) } }
  }) }
}
