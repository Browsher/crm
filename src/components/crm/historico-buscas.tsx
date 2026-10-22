import Link from 'next/link'
import type { ResumoBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
const estados = { reservada: 'Em processamento', concluida: 'Concluída', falhou: 'Falhou' }
export function HistoricoBuscas({ buscas, gestor = false }: { buscas: ResumoBusca[]; gestor?: boolean }) {
  return <section aria-label="Histórico de buscas">
    <h2>Últimas buscas</h2>
    {!buscas.length ? <p>Nenhuma busca no CNPJ.biz realizada ainda.</p> : <ul>{buscas.map(b => <li key={b.id}>
      <Link href={`${gestor ? '/empresas/busca' : '/fila/buscar'}?busca=${b.id}`}>{b.nome}</Link>
      <p>{gestor ? b.vendedor + ' · ' : ''}{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(b.criado_em))} · {estados[b.estado]}</p>
      <p>{b.filtros.quantidade} solicitadas · {b.retornadas} retornadas · {b.filtros.uf}{b.filtros.cidade ? ' / ' + b.filtros.cidade : ''}</p>
      {b.motivo && <p>{mensagemBusca(b.motivo)}</p>}
    </li>)}</ul>}
  </section>
}
