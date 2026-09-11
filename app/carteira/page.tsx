import Link from 'next/link'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { FiltrosForm } from './filtros-form'
import { lerFiltrosCarteira } from './filtros'
import { ListaCarteira } from './lista'
import styles from './carteira.module.css'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaCarteira({ searchParams }: Props) {
  const eu = await exigir('usuario')
  const [r, params] = await Promise.all([lerMinhasEmpresas(eu.usuarioId), searchParams])
  const leitura = lerFiltrosCarteira(params)

  return <main className={styles.pagina}>
    <header>
      <h1>Minha carteira</h1>
      <p>Clientes que estão sob seus cuidados.</p>
    </header>
    {!r.ok ? <p role="alert">{textoDoMotivo(r.motivo)}</p> : !leitura.ok ? <div role="alert" className={styles.vazio}>
      <h2>Filtros inválidos</h2>
      <p>Os filtros informados não puderam ser aplicados.</p>
      <Link href="/carteira">Limpar filtros</Link>
    </div> : <>
      <FiltrosForm filtros={leitura.filtros}
        ufs={r.carteira.flatMap(empresa => empresa.endereco ? [empresa.endereco.uf] : [])} />
      <ListaCarteira linhas={r.carteira} filtros={leitura.filtros} />
    </>}
  </main>
}
