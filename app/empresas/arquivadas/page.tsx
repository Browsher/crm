import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Alert } from '@/src/components/ui/alert'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { listarGrupos, paginaGrupos } from '@/src/features/empresas/grupos'
import { lerConsulta, MAX_TERMO, totalDePaginas } from '@/src/features/empresas/consulta'
import { serializarRetornoGestor, urlRetornoGestor } from '@/src/lib/retorno-gestor'
import { PaginacaoGrupos } from '../grupos/apresentacao'
import { Lista } from '../lista'
import styles from '../empresas.module.css'

export default async function ArquivoEmpresas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.replace(/\p{Cc}/gu, ' ') : undefined
  const consulta = lerConsulta({ q, pagina: String(paginaGrupos(params.pagina)) })
  const gruposPagina = paginaGrupos(params.gruposPagina)
  const arquivo = { tipo: 'arquivo', q: consulta.termo.toWellFormed(), pagina: consulta.pagina, gruposPagina } as const
  const [r, grupos] = await Promise.all([
    listarEmpresas(eu.usuarioId, consulta, true),
    listarGrupos(eu.usuarioId, gruposPagina, true),
  ])
  const endereco = (pagina: number) => urlRetornoGestor({ ...arquivo, pagina })
  const foraDaPagina = r.ok && consulta.pagina > 1 && r.linhas.length === 0
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Arquivo de empresas" descricao="Empresas e listas retiradas do trabalho ativo. Histórico preservado, somente consulta." acoes={<Button asChild variant="outline"><Link href="/empresas">Empresas ativas</Link></Button>} />
    {grupos.ok && <section aria-labelledby="listas-arquivadas" className="grid gap-4">
      <h2 id="listas-arquivadas" className="text-lg font-semibold">Listas arquivadas</h2>
      {grupos.grupos.length ? <ul className={styles.cartoes}>{grupos.grupos.map(g => <li key={g.id}>
        <Card><CardHeader><CardTitle><h3>{g.nome}</h3></CardTitle><CardDescription>{g.total} {g.total === 1 ? 'empresa' : 'empresas'}</CardDescription></CardHeader>
          <CardFooter><Button asChild variant="outline"><Link href={urlRetornoGestor({ tipo: 'grupo', id: g.id, pagina: 1, gruposPagina, arquivo })}>Ver lista</Link></Button></CardFooter>
        </Card>
      </li>)}</ul> : <p>{gruposPagina > 1 ? 'Nenhuma lista nesta página.' : 'Nenhuma lista arquivada.'}</p>}
      <PaginacaoGrupos pagina={gruposPagina} total={grupos.resumo.total} rotulo="Paginação de listas arquivadas"
        endereco={pagina => urlRetornoGestor({ ...arquivo, gruposPagina: pagina })} />
    </section>}
    <form action="/empresas/arquivadas" className="flex flex-wrap items-end gap-3">
      {gruposPagina > 1 && <input type="hidden" name="gruposPagina" value={gruposPagina} />}
      <label>Nome ou CNPJ<Input name="q" defaultValue={consulta.termo} maxLength={MAX_TERMO} /></label>
      <Button type="submit" variant="outline">Consultar arquivo</Button>
    </form>
    {!r.ok ? <Alert variant="danger">Você não tem permissão para consultar o arquivo.</Alert> :
      foraDaPagina ? <EstadoVazio titulo="Nenhuma empresa nesta página" descricao="Volte à primeira página para consultar o arquivo com esta busca."
        acao={{ rotulo: 'Voltar à primeira página', href: endereco(1), variante: 'outline' }} /> : <>
        <p className={styles.contagem}>{r.total} {r.total === 1 ? 'empresa arquivada' : 'empresas arquivadas'}</p>
        <Lista linhas={r.linhas} retorno={serializarRetornoGestor(arquivo)} vazio={{
          descricao: consulta.termo ? 'Tente outro nome ou CNPJ, ou consulte o arquivo completo.' : 'Nenhuma empresa foi arquivada.',
          acao: consulta.termo ? { rotulo: 'Limpar busca do arquivo', href: urlRetornoGestor({ ...arquivo, q: '' }), variante: 'outline' } : undefined,
        }} />
        {totalDePaginas(r.total) > 1 && <nav aria-label="Paginação do arquivo" className={styles.paginacao}>
          {consulta.pagina > 1 && <Link href={endereco(consulta.pagina - 1)}>Anterior</Link>}
          <span>Página {consulta.pagina} de {totalDePaginas(r.total)}</span>
          {consulta.pagina < totalDePaginas(r.total) && <Link href={endereco(consulta.pagina + 1)}>Próxima</Link>}
        </nav>}
      </>}
  </main>
}
