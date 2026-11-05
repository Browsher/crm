import type { Contato } from './historico'
import { ROTULO, ehTipo } from './tipos'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { HistoricoComercial } from '@/src/components/crm/historico-comercial'
import type { EventoHistoricoComercial } from '@/src/lib/historico-comercial'

function rotulo(tipo: string): string {
  // O banco só exige não-vazio, então o texto de tipos antigos é preservado.
  return ehTipo(tipo) ? ROTULO[tipo] : tipo
}

export function LinhaDoTempo({ contatos }: { contatos: Contato[] }) {
  if (contatos.length === 0) {
    return <EstadoVazio nivelTitulo={3} titulo="Nenhum contato registrado nesta empresa ainda." descricao="Os atendimentos registrados nesta empresa aparecerão aqui." />
  }
  const eventos: EventoHistoricoComercial[] = contatos.map(contato => {
    const natureza = contato.venda ? 'venda' : contato.natureza ?? (contato.tipo === 'nao_liguei' ? 'atividade_sem_ligacao' : 'contato')
    const resultado = rotulo(contato.tipo)
    return {
      id: contato.id,
      natureza,
      titulo: natureza === 'venda' ? 'Venda registrada' : natureza === 'atividade_sem_ligacao' ? 'Atividade sem ligação' : resultado,
      criadoEm: contato.criadoEm.toISOString(),
      autor: contato.autor,
      nota: contato.nota,
      ...(natureza !== 'venda' ? { resultado } : {}),
      ...(contato.proximoPasso ? { proximoPasso: { descricao: contato.proximoPasso, data: contato.proximoPassoData } } : {}),
      ...(contato.venda ? { venda: contato.venda } : {}),
    }
  })
  return <HistoricoComercial eventos={eventos} />
}
