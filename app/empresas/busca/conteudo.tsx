import Link from 'next/link'
import type { BuscaSalva } from '@/src/features/busca-empresas/tipos'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import { EmpresaEncontradaDetalhes } from '@/src/components/crm/empresa-encontrada'
import { CriteriosBanco } from '@/src/components/crm/criterios-banco'
import { CardDetalhes } from '@/src/components/crm/card-detalhes'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { ResultadosBusca } from '../../fila/buscar/resultados'
import { SociosGestor } from '../socios-gestor'
import styles from '@/src/components/crm/busca-dialogo.module.css'

const estados = { reservada: 'Em processamento', concluida: 'Concluída', falhou: 'Falhou' }
export function ConteudoBusca({ busca, gestor, bloqueada, retornadas = busca.empresas.length }: { busca: BuscaSalva; gestor: boolean; bloqueada: boolean; retornadas?: number }) {
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(busca.criado_em))
  return <div className="grid min-w-0 gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div><p className="font-medium">{busca.fornecedor ?? 'CNPJ.biz'}{gestor ? ` · ${busca.vendedor}` : ''}</p><p className="text-muted-foreground">{data} · {busca.filtros.quantidade} solicitadas · {retornadas} retornadas</p></div>
      <Badge variant={busca.estado === 'falhou' ? 'danger' : 'outline'}>{estados[busca.estado]}</Badge>
    </div>
    <CardDetalhes titulo="Filtros usados">
      {busca.filtros.avancados ? <CriteriosBanco filtros={busca.filtros.avancados} /> : <dl className={styles.dados}>
        {Object.entries({ 'Nome ou palavra-chave': busca.filtros.palavra, 'CNAE principal': busca.filtros.cnae, Estado: busca.filtros.uf, Cidade: busca.filtros.cidade, Bairro: busca.filtros.bairro, Porte: busca.filtros.porte,
          Estabelecimento: busca.filtros.tipo === '2' ? 'Matriz' : busca.filtros.tipo === '1' ? 'Filial' : '', 'Contato disponível': busca.filtros.contato, 'Resultados pulados': String(busca.filtros.offset) }).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>}
    </CardDetalhes>
    {busca.estado === 'reservada' ? <p role="status">Consulta em processamento ou sem confirmação. Feche e abra a busca para conferir novamente. Ela não será repetida automaticamente.</p>
      : busca.estado === 'falhou' ? <p role="alert">{busca.motivo ? mensagemBusca(busca.motivo) : 'Não foi possível concluir a consulta.'}</p>
      : gestor ? <>
        {!busca.empresas.length ? <p>Nenhuma empresa encontrada com esses filtros. Confira os filtros usados acima.</p> : <ul className={styles.lista}>{busca.empresas.map(e => <li key={e.cnpj}><EmpresaEncontradaDetalhes empresa={e} /></li>)}</ul>}
        <SociosGestor buscaId={busca.id} />
        {busca.grupo_id && <Button asChild variant="outline"><Link href={`/empresas/grupos/${busca.grupo_id}`}>Ver lista importada</Link></Button>}
      </> : <ResultadosBusca busca={busca} bloqueada={bloqueada} />}
  </div>
}
