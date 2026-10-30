import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/src/components/ui/table'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { detalharGrupo, paginaGrupos, type EmpresaGrupo } from '@/src/features/empresas/grupos'
import { dataGrupo, PaginacaoGrupos, SituacaoGrupo } from '../apresentacao'
import { MetadadosGrupo } from '../metadados'
import { ControlesGrupo } from '../controles'
import { Button } from '@/src/components/ui/button'
import styles from '../grupos.module.css'

const SITUACOES: Record<EmpresaGrupo['situacao'], string> = {
  disponivel: 'Disponível', carteira: 'Em carteira', reservada: 'Reservada', em_descanso: 'Em descanso', origem_bloqueada: 'Origem bloqueada',
  arquivada: 'Arquivada',
}
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }
export default async function DetalheGrupo({ params, searchParams }: Props) {
  const eu = await exigir('gestor')
  const { id } = await params
  const busca = await searchParams
  const pagina = paginaGrupos(busca.pagina)
  const gruposPagina = paginaGrupos(busca.gruposPagina)
  const r = await detalharGrupo(eu.usuarioId, id, pagina)
  if (!r.ok) {
    if (r.motivo === 'nao_encontrado') notFound()
    return <main className={styles.pagina}><Alert variant="danger">Você não tem permissão para consultar esta lista.</Alert><Button asChild variant="outline"><Link href="/empresas/grupos">Voltar às listas</Link></Button></main>
  }
  const { grupo: g, contagens: c } = r
  return <main className={styles.pagina}>
    <nav aria-label="Navegação estrutural" className={styles.breadcrumb}><Button asChild variant="outline"><Link href={`/empresas/grupos?pagina=${gruposPagina}`}>Listas de empresas</Link></Button><span aria-hidden="true">/</span><span>{g.nome}</span></nav>
    <header className={styles.cabecalho}><div><h1>{g.nome}</h1><p>{g.arquivoNome ?? g.origem ?? 'Cadastros anteriores'}</p><p>Criada por {g.autor ?? 'Migração'} em <time dateTime={g.criadoEm}>{dataGrupo(g.criadoEm)}</time></p></div>{!g.arquivada && <ControlesGrupo id={g.id} nome={g.nome} ativo={g.ativo} impactoDesativacao={r.impactoDesativacao} />}</header>
    <div className={styles.faixa}>{g.arquivada ? <Badge variant="outline">Arquivada</Badge> : <SituacaoGrupo ativo={g.ativo} />}<Button asChild variant="outline"><Link href={g.arquivada ? '/empresas/arquivadas' : '/empresas'}>{g.arquivada ? 'Arquivo de empresas' : 'Todas as empresas'}</Link></Button></div>
    {g.arquivada ? <><Alert role="note">Arquivo histórico, somente consulta.</Alert><dl><dt>Descrição</dt><dd>{g.descricao ?? 'Não informada'}</dd><dt>Origem</dt><dd>{g.origem ?? 'Não informada'}</dd><dt>Critérios</dt><dd>{g.criterios ?? 'Não informados'}</dd></dl></> : <MetadadosGrupo id={g.id} descricao={g.descricao} origem={g.origem} criterios={g.criterios} />}
    <dl className={styles.resumo}>
      <div><dt>Empresas</dt><dd>{c.total}</dd></div><div><dt>Disponíveis</dt><dd>{c.disponiveis}</dd></div><div><dt>Em carteiras</dt><dd>{c.carteiras}</dd></div><div><dt>Reservadas</dt><dd>{c.reservadas}</dd></div><div><dt>Outros impedimentos</dt><dd>{c.outros}</dd></div>
    </dl>
    {!g.ativo && !g.arquivada && <Alert variant="warning" role="note">Lista desativada. Carteiras e reservas atuais são preservadas. Empresas com outra lista ativa podem continuar disponíveis.</Alert>}
    {r.empresas.length === 0 ? <EstadoVazio titulo="Nenhuma empresa nesta página" descricao="Volte à primeira página para consultar as empresas desta lista." acao={{ rotulo: 'Voltar à primeira página', href: `/empresas/grupos/${id}?gruposPagina=${gruposPagina}`, variante: 'outline' }} /> :
      <div className={styles.rolagem} tabIndex={0} role="region" aria-label="Empresas da lista"><Table className={`${styles.tabela} crm-registros`}>
        <TableHeader><TableRow><TableHead scope="col">Empresa</TableHead><TableHead scope="col">Atendimento</TableHead><TableHead scope="col">Outras listas</TableHead></TableRow></TableHeader>
        <TableBody>{r.empresas.map(e => <TableRow key={e.id}>
          <TableCell data-label="Empresa"><Link className="underline" href={`/empresas/${e.id}`}><strong>{nomeEmpresa(e)}</strong></Link><span className={styles.secundario}>{e.cnpj ?? 'Não informado'}</span></TableCell>
          <TableCell data-label="Atendimento"><Badge variant={e.situacao === 'disponivel' ? 'success' : 'outline'}>{SITUACOES[e.situacao]}</Badge>
            {e.responsavel && <span className={styles.secundario}>{e.responsavel}{e.responsavelAtivo === false ? ' (inativo)' : ''}</span>}
            {e.situacao === 'reservada' && <span className={styles.secundario}>{e.reservadoPor}{e.reservadoAte ? ` até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(e.reservadoAte))}` : ''}</span>}
            {e.situacao === 'em_descanso' && e.elegivelEm && <span className={styles.secundario}>Até {dataGrupo(e.elegivelEm)}</span>}
            {e.situacao === 'origem_bloqueada' && <span className={styles.secundario}>Sem grupo ativo</span>}
          </TableCell>
          <TableCell data-label="Outras listas">{e.outrosGrupos.length ? <ul className={styles.outros}>{e.outrosGrupos.map(outro => <li key={outro.id}><Button asChild variant="outline"><Link href={`/empresas/grupos/${outro.id}?gruposPagina=${gruposPagina}`}>{outro.nome}</Link></Button> <span className={styles.secundario}>({outro.ativo ? 'ativo' : 'desativado'})</span></li>)}</ul> : <span className={styles.secundario}>Nenhuma outra lista</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    <PaginacaoGrupos pagina={pagina} total={c.total} caminho={`/empresas/grupos/${id}`} gruposPagina={gruposPagina} />
  </main>
}
