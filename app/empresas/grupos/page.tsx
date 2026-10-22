import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/src/components/ui/table'
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
      {r.grupos.length === 0 ? <div className={styles.vazio}><h2>{r.resumo.total === 0 ? 'Nenhum grupo de importação' : 'Nenhum grupo nesta página'}</h2><p>{r.resumo.total === 0 ? 'Importe uma planilha para criar um grupo.' : 'Volte à primeira página para consultar os grupos existentes.'}</p><Link href={r.resumo.total === 0 ? '/empresas/importar' : '/empresas/grupos'}>{r.resumo.total === 0 ? 'Importar planilha' : 'Voltar à primeira página'}</Link></div> :
        <div className={styles.rolagem} tabIndex={0} role="region" aria-label="Grupos de importação"><Table className={`${styles.tabela} crm-registros`}>
          <TableHeader><TableRow><TableHead scope="col">Grupo / Planilha</TableHead><TableHead scope="col">Situação</TableHead><TableHead scope="col">Empresas</TableHead><TableHead scope="col">Importado em</TableHead><TableHead scope="col">Ação</TableHead></TableRow></TableHeader>
          <TableBody>{r.grupos.map(g => <TableRow key={g.id}>
            <TableCell data-label="Grupo"><strong>{g.nome}</strong><span className={styles.secundario}>{g.arquivoNome ?? 'Cadastros anteriores'}</span></TableCell>
            <TableCell data-label="Situação"><SituacaoGrupo ativo={g.ativo} /></TableCell><TableCell data-label="Empresas">{g.total}</TableCell>
            <TableCell data-label="Importado em"><time dateTime={g.criadoEm}>{dataGrupo(g.criadoEm)}</time><span className={styles.secundario}>{g.autor ?? 'Migração'}</span></TableCell>
            <TableCell><Link aria-label={`Ver grupo ${g.nome}`} href={`/empresas/grupos/${g.id}?gruposPagina=${pagina}`}>Ver grupo</Link></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      <PaginacaoGrupos pagina={pagina} total={r.resumo.total} caminho="/empresas/grupos" />
    </>}
  </main>
}
