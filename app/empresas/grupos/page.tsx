import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { Alert } from '@/src/components/ui/alert'
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
    <CabecalhoPagina titulo="Listas de empresas" descricao="Confira a origem e a disponibilidade das listas compartilhadas." acoes={<> <Button variant="outline" asChild><Link href="/empresas/google">Planejamentos e coletas do Google</Link></Button><Button variant="outline" asChild><Link href="/empresas">Todas as empresas</Link></Button><Button asChild><Link href="/empresas/importar">Importar planilha</Link></Button> </>} />
    {!r.ok ? <Alert variant="danger">Você não tem permissão para consultar os grupos.</Alert> : <>
      <dl className={styles.resumo}>
        <div><dt>Total de listas</dt><dd>{r.resumo.total}</dd></div>
        <div><dt>Ativos</dt><dd>{r.resumo.ativos}</dd></div>
        <div><dt>Desativados</dt><dd>{r.resumo.desativados}</dd></div>
        <div><dt>Empresas únicas vinculadas</dt><dd>{r.resumo.empresas}</dd></div>
      </dl>
      {r.grupos.length === 0 ? <EstadoVazio titulo={r.resumo.total === 0 ? 'Nenhuma lista compartilhada' : 'Nenhuma lista nesta página'}
        descricao={r.resumo.total === 0 ? 'Importe uma planilha ou consulte as coletas do Google.' : 'Volte à primeira página para consultar as listas existentes.'}
        acao={{ rotulo: r.resumo.total === 0 ? 'Importar planilha' : 'Voltar à primeira página', href: r.resumo.total === 0 ? '/empresas/importar' : '/empresas/grupos', variante: 'outline' }} /> :
        <div className={styles.rolagem} tabIndex={0} role="region" aria-label="Listas de empresas"><Table className={`${styles.tabela} crm-registros`}>
          <TableHeader><TableRow><TableHead scope="col">Lista / Origem</TableHead><TableHead scope="col">Situação</TableHead><TableHead scope="col">Empresas</TableHead><TableHead scope="col">Criada em</TableHead><TableHead scope="col">Ação</TableHead></TableRow></TableHeader>
          <TableBody>{r.grupos.map(g => <TableRow key={g.id}>
            <TableCell data-label="Lista"><strong>{g.nome}</strong><span className={styles.secundario}>{g.arquivoNome ?? g.origem ?? 'Cadastros anteriores'}</span></TableCell>
            <TableCell data-label="Situação"><SituacaoGrupo ativo={g.ativo} /></TableCell><TableCell data-label="Empresas">{g.total}</TableCell>
            <TableCell data-label="Importado em"><time dateTime={g.criadoEm}>{dataGrupo(g.criadoEm)}</time><span className={styles.secundario}>{g.autor ?? 'Migração'}</span></TableCell>
            <TableCell data-label="Ação"><Button asChild variant="outline"><Link aria-label={`Ver lista ${g.nome}`} href={`/empresas/grupos/${g.id}?gruposPagina=${pagina}`}>Ver lista</Link></Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      <PaginacaoGrupos pagina={pagina} total={r.resumo.total} caminho="/empresas/grupos" />
    </>}
  </main>
}
