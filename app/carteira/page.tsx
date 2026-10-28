import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { FiltrosForm } from './filtros-form'
import { lerFiltrosCarteira } from './filtros'
import { ListaCarteira } from './lista'
import styles from './carteira.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaCarteira({ searchParams }: Props) {
  const eu = await exigir('vendedor')
  const [r, params] = await Promise.all([lerMinhasEmpresas(eu.usuarioId, true), searchParams])
  const leitura = lerFiltrosCarteira(params)

  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Minha carteira" descricao="Clientes que estão sob seus cuidados." />
    {!r.ok ? <p role="alert">{textoDoMotivo(r.motivo)}</p> : !leitura.ok ? <Alert variant="warning">
      <AlertTitle><h2>Filtros inválidos</h2></AlertTitle>
      <AlertDescription><p>Os filtros informados não puderam ser aplicados.</p></AlertDescription>
      <Button asChild variant="outline"><Link href="/carteira">Limpar filtros</Link></Button>
    </Alert> : <>
      <FiltrosForm filtros={leitura.filtros}
        ufs={r.carteira.flatMap(empresa => empresa.endereco ? [empresa.endereco.uf] : [])} />
      <ListaCarteira linhas={r.carteira} filtros={leitura.filtros} />
    </>}
  </main>
}
