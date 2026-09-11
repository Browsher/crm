import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerPerfil } from '@/src/features/prospeccao/recentes'
import { lerFiltros } from '@/src/features/prospeccao/filtros'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { Resultados } from '../resultados'
import { RegistrarVisita } from '../registrar-visita'
import { urlConsulta } from '../navegacao'
import { EtapasFila } from '../../etapas'
import styles from '../localizar.module.css'

export default async function PaginaPerfil({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const eu = await exigir('usuario')
  const { id } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  const entrada = lerFiltros(await searchParams)
  if (!entrada.ok) return <main className={styles.pagina}><p role="alert">Um dos filtros é inválido.</p><Link href="/fila/localizar">Limpar filtros</Link></main>
  const r = await lerPerfil(eu.usuarioId, id)
  if (!r.ok) return <main className={styles.pagina}><p role="alert">Você não tem permissão para consultar empresas.</p></main>
  if (!r.empresa) notFound()
  const minhas = await lerMinhasEmpresas(eu.usuarioId)
  const filtros = entrada.filtros
  return <main className={styles.pagina}>
    <EtapasFila etapa="consultar" filtros={filtros} />
    <header className={styles.cabecalho}>
      <h1>Perfil da empresa</h1>
      <Link href={urlConsulta(filtros, filtros.pagina)} className="text-sm underline">Voltar para localizar</Link>
    </header>
    <RegistrarVisita empresaId={id} />
    <Resultados empresas={[r.empresa]} mostrarPerfil={false} filtros={filtros}
      reserva={minhas.ok ? { contexto: minhas.contexto, filtros, empresaAtual: minhas.reserva?.id ?? null } : undefined} />
  </main>
}
