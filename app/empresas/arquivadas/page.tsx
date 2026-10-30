import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Alert } from '@/src/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { listarGrupos } from '@/src/features/empresas/grupos'
import { lerConsulta, totalDePaginas } from '@/src/features/empresas/consulta'
import { Lista } from '../lista'
import styles from '../empresas.module.css'

export default async function ArquivoEmpresas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const consulta = lerConsulta(await searchParams)
  const [r, grupos] = await Promise.all([listarEmpresas(eu.usuarioId, consulta, true), listarGrupos(eu.usuarioId, 1, true)])
  const endereco = (pagina: number) => '/empresas/arquivadas?' + new URLSearchParams({ q: consulta.termo, pagina: String(pagina) })
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Arquivo de empresas" descricao="Empresas e listas retiradas do trabalho ativo. Histórico preservado, somente consulta." acoes={<Button asChild variant="outline"><Link href="/empresas">Empresas ativas</Link></Button>} />
    {grupos.ok && <section aria-labelledby="listas-arquivadas" className="grid gap-4">
      <h2 id="listas-arquivadas" className="text-lg font-semibold">Listas arquivadas</h2>
      <ul className={styles.cartoes}>{grupos.grupos.map(g => <li key={g.id}>
        <Card><CardHeader><CardTitle><h3>{g.nome}</h3></CardTitle><CardDescription>{g.total} {g.total === 1 ? 'empresa' : 'empresas'}</CardDescription></CardHeader>
          <CardFooter><Button asChild variant="outline"><Link href={`/empresas/grupos/${g.id}`}>Ver lista</Link></Button></CardFooter>
        </Card>
      </li>)}</ul>
    </section>}
    <form action="/empresas/arquivadas" className="flex flex-wrap items-end gap-3"><label>Nome ou CNPJ<Input name="q" defaultValue={consulta.termo} maxLength={100} /></label><Button type="submit" variant="outline">Consultar arquivo</Button></form>
    {!r.ok ? <Alert variant="danger">Você não tem permissão para consultar o arquivo.</Alert> : <>
      <p className={styles.contagem}>{r.total} {r.total === 1 ? 'empresa arquivada' : 'empresas arquivadas'}</p>
      <Lista linhas={r.linhas} />
      <nav aria-label="Paginação do arquivo" className={styles.paginacao}>
        {consulta.pagina > 1 && <Link href={endereco(consulta.pagina - 1)}>Anterior</Link>}
        <span>Página {consulta.pagina} de {Math.max(1,totalDePaginas(r.total))}</span>
        {consulta.pagina < totalDePaginas(r.total) && <Link href={endereco(consulta.pagina + 1)}>Próxima</Link>}
      </nav>
    </>}
  </main>
}
