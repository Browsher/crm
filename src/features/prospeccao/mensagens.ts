import type { Disponibilidade } from './tipos'

const mensagens: Record<Disponibilidade, { titulo: string; detalhe: string | null }> = {
  disponivel: { titulo: 'Disponível', detalhe: null },
  comigo: { titulo: 'Com você', detalhe: null },
  reservada_comigo: { titulo: 'Reservada com você', detalhe: null },
  outro_vendedor: { titulo: 'Indisponível', detalhe: 'Com outro vendedor' },
  em_descanso: { titulo: 'Indisponível', detalhe: 'Em descanso' },
}

export function mensagemDisponibilidade(disponibilidade: Disponibilidade) {
  return mensagens[disponibilidade]
}

export function mensagemConsulta(motivo: 'sem_permissao' | 'grupo_indisponivel'): string {
  return motivo === 'grupo_indisponivel' ? 'Esta lista está indisponível. Escolha outra lista ativa.' : 'Você não tem permissão para consultar empresas.'
}
