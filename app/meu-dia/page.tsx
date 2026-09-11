import Link from 'next/link'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { agendaDoDia, filtrarAgenda, lerFiltrosMeuDia } from './agenda'
import { FiltrosForm } from './filtros-form'
import { PainelMeuDia } from './painel'
import styles from './meu-dia.module.css'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function PaginaMeuDia({ searchParams }: Props) {
  const eu = await exigir('usuario')
  const [r, params] = await Promise.all([lerMinhasEmpresas(eu.usuarioId), searchParams])
  const leitura = lerFiltrosMeuDia(params)
  const agenda = r.ok ? agendaDoDia(r.carteira) : []
  const filtradas = leitura.ok ? filtrarAgenda(agenda, leitura.filtros) : []

  return <main className={styles.pagina}>
    <header>
      <h1>Meu dia</h1>
      <p>Retornos atrasados e de hoje.</p>
    </header>
    {!r.ok ? <p role="alert">{textoDoMotivo(r.motivo)}</p> : !leitura.ok ? <div role="alert" className={styles.vazio}>
      <h2>Filtros inválidos</h2>
      <p>Os filtros informados não puderam ser aplicados.</p>
      <Link href="/meu-dia">Limpar filtros</Link>
    </div> : <>
      <FiltrosForm filtros={leitura.filtros} />
      <p className={styles.contagem}>{filtradas.length} de {agenda.length} {agenda.length === 1 ? 'retorno' : 'retornos'}</p>
      <PainelMeuDia linhas={filtradas} filtros={leitura.filtros} />
    </>}
  </main>
}
