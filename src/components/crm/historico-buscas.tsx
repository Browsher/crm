import { BuscaPainel, FiltrosBuscaPainel } from './busca-dialogo'
import { FiltrosUsadosBusca } from '@/app/empresas/busca/conteudo'
import { lerAtendimentoBuscaAcao, lerDetalheBuscaAcao } from '@/app/empresas/busca/detalhe-acao'
import type { ResumoBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
const estados = { reservada: 'Em processamento', concluida: 'Concluída', falhou: 'Falhou' }
export function HistoricoBuscas({ buscas, gestor = false }: { buscas: ResumoBusca[]; gestor?: boolean }) {
  return <section aria-label="Histórico de buscas">
    <h2>Últimas buscas</h2>
    {!buscas.length ? <p>Nenhuma busca no banco de empresas realizada ainda.</p> : <ul>{buscas.map(b => <li key={b.id}>
      <h3>{b.nome}</h3><p>{b.fornecedor ?? 'CNPJ.biz'}</p>
      <p>{gestor ? b.vendedor + ' · ' : ''}{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(b.criado_em))} · {estados[b.estado]}</p>
      <p>{b.filtros.quantidade} solicitadas · {b.retornadas} retornadas · {b.filtros.uf}{b.filtros.cidade ? ' / ' + b.filtros.cidade : ''}</p>
      {b.motivo && <p>{mensagemBusca(b.motivo)}</p>}
      <div className="flex flex-wrap gap-2">
        <BuscaPainel nome={b.nome} carregarAcao={lerDetalheBuscaAcao.bind(null, b.id, !gestor)}
          carregarAtendimentoAcao={gestor ? undefined : lerAtendimentoBuscaAcao.bind(null, b.id)} />
        <FiltrosBuscaPainel nome={b.nome}><FiltrosUsadosBusca filtros={b.filtros} /></FiltrosBuscaPainel>
      </div>
    </li>)}</ul>}
  </section>
}
