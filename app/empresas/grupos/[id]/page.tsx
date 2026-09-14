import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { detalharGrupo, paginaGrupos, type EmpresaGrupo } from '@/src/features/empresas/grupos'
import { dataGrupo, PaginacaoGrupos, SituacaoGrupo } from '../apresentacao'
import { ControlesGrupo } from '../controles'
import styles from '../grupos.module.css'

const SITUACOES: Record<EmpresaGrupo['situacao'], string> = {
  disponivel: 'Disponível', carteira: 'Em carteira', reservada: 'Reservada', em_descanso: 'Em descanso', origem_bloqueada: 'Origem bloqueada',
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
    return <main className={styles.pagina}><p role="alert">Você não tem permissão para consultar este grupo.</p><Link href="/empresas/grupos">Voltar aos grupos</Link></main>
  }
  const { grupo: g, contagens: c } = r
  return <main className={styles.pagina}>
    <nav aria-label="Navegação estrutural" className={styles.breadcrumb}><Link href={`/empresas/grupos?pagina=${gruposPagina}`}>Grupos de importação</Link><span aria-hidden="true">/</span><span>{g.nome}</span></nav>
    <header className={styles.cabecalho}><div><h1>{g.nome}</h1><p>{g.arquivoNome ?? 'Cadastros anteriores'}</p><p>Importado por {g.autor ?? 'Migração'} em <time dateTime={g.criadoEm}>{dataGrupo(g.criadoEm)}</time></p></div><ControlesGrupo id={g.id} nome={g.nome} ativo={g.ativo} impactoDesativacao={r.impactoDesativacao} /></header>
    <div className={styles.faixa}><SituacaoGrupo ativo={g.ativo} /><Link href="/empresas">Todas as empresas</Link></div>
    <dl className={styles.resumo}>
      <div><dt>Empresas</dt><dd>{c.total}</dd></div><div><dt>Disponíveis</dt><dd>{c.disponiveis}</dd></div><div><dt>Em carteiras</dt><dd>{c.carteiras}</dd></div><div><dt>Reservadas</dt><dd>{c.reservadas}</dd></div><div><dt>Outros impedimentos</dt><dd>{c.outros}</dd></div>
    </dl>
    {!g.ativo && <p className={styles.aviso}>Grupo desativado. Carteiras e reservas atuais são preservadas. Empresas com outro grupo ativo podem continuar disponíveis.</p>}
    {r.empresas.length === 0 ? <div className={styles.vazio}><h2>Nenhuma empresa nesta página</h2><Link href={`/empresas/grupos/${id}?gruposPagina=${gruposPagina}`}>Voltar à primeira página</Link></div> :
      <div className={styles.rolagem} tabIndex={0} role="region" aria-label="Empresas do grupo"><table className={styles.tabela}>
        <thead><tr><th scope="col">Empresa</th><th scope="col">Atendimento</th><th scope="col">Outros grupos</th></tr></thead>
        <tbody>{r.empresas.map(e => <tr key={e.id}>
          <td><strong>{e.razaoSocial}</strong><span className={styles.secundario}>{e.cnpj}</span></td>
          <td><strong>{SITUACOES[e.situacao]}</strong>
            {e.responsavel && <span className={styles.secundario}>{e.responsavel}{e.responsavelAtivo === false ? ' (inativo)' : ''}</span>}
            {e.situacao === 'reservada' && <span className={styles.secundario}>{e.reservadoPor}{e.reservadoAte ? ` até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(e.reservadoAte))}` : ''}</span>}
            {e.situacao === 'em_descanso' && e.elegivelEm && <span className={styles.secundario}>Até {dataGrupo(e.elegivelEm)}</span>}
            {e.situacao === 'origem_bloqueada' && <span className={styles.secundario}>Sem grupo ativo</span>}
          </td>
          <td>{e.outrosGrupos.length ? <ul className={styles.outros}>{e.outrosGrupos.map(outro => <li key={outro.id}><Link href={`/empresas/grupos/${outro.id}?gruposPagina=${gruposPagina}`}>{outro.nome}</Link> <span className={styles.secundario}>({outro.ativo ? 'ativo' : 'desativado'})</span></li>)}</ul> : <span className={styles.secundario}>Nenhum outro grupo</span>}</td>
        </tr>)}</tbody>
      </table></div>}
    <PaginacaoGrupos pagina={pagina} total={c.total} caminho={`/empresas/grupos/${id}`} gruposPagina={gruposPagina} />
  </main>
}
