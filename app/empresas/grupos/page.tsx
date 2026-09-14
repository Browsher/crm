import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { exigir } from '@/src/server/autenticacao/guarda'
import { listarGrupos, paginaGrupos } from '@/src/features/empresas/grupos'
import { dataGrupo, PaginacaoGrupos, SituacaoGrupo } from './apresentacao'
import styles from './grupos.module.css'

export default async function PaginaGrupos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const pagina = paginaGrupos((await searchParams).pagina)
  const r = await listarGrupos(eu.usuarioId, pagina)
  return <main className={styles.pagina}>
    <header className={styles.cabecalho}>
      <div><h1>Grupos de importação</h1><p>Gerencie as planilhas e a disponibilidade das empresas para prospecção.</p></div>
      <div className={styles.acoes}><Button variant="outline" asChild><Link href="/empresas">Todas as empresas</Link></Button><Button asChild><Link href="/empresas/importar">Importar planilha</Link></Button></div>
    </header>
    {!r.ok ? <p role="alert">Você não tem permissão para consultar os grupos.</p> : <>
      <dl className={styles.resumo}>
        <div><dt>Total de grupos</dt><dd>{r.resumo.total}</dd></div>
        <div><dt>Ativos</dt><dd>{r.resumo.ativos}</dd></div>
        <div><dt>Desativados</dt><dd>{r.resumo.desativados}</dd></div>
        <div><dt>Empresas únicas vinculadas</dt><dd>{r.resumo.empresas}</dd></div>
      </dl>
      {r.grupos.length === 0 ? <div className={styles.vazio}><h2>{r.resumo.total === 0 ? 'Nenhum grupo de importação' : 'Nenhum grupo nesta página'}</h2><p>Importe uma planilha para criar um grupo.</p><Link href={r.resumo.total === 0 ? '/empresas/importar' : '/empresas/grupos'}>{r.resumo.total === 0 ? 'Importar planilha' : 'Voltar à primeira página'}</Link></div> :
        <div className={styles.rolagem} tabIndex={0} role="region" aria-label="Grupos de importação"><table className={styles.tabela}>
          <thead><tr><th scope="col">Grupo / Planilha</th><th scope="col">Situação</th><th scope="col">Empresas</th><th scope="col">Importado em</th><th scope="col">Ação</th></tr></thead>
          <tbody>{r.grupos.map(g => <tr key={g.id}>
            <td><strong>{g.nome}</strong><span className={styles.secundario}>{g.arquivoNome ?? 'Cadastros anteriores'}</span></td>
            <td><SituacaoGrupo ativo={g.ativo} /></td><td>{g.total}</td>
            <td><time dateTime={g.criadoEm}>{dataGrupo(g.criadoEm)}</time><span className={styles.secundario}>{g.autor ?? 'Migração'}</span></td>
            <td><Link aria-label={`Ver grupo ${g.nome}`} href={`/empresas/grupos/${g.id}?gruposPagina=${pagina}`}>Ver grupo</Link></td>
          </tr>)}</tbody>
        </table></div>}
      <PaginacaoGrupos pagina={pagina} total={r.resumo.total} caminho="/empresas/grupos" />
    </>}
  </main>
}
