import Link from 'next/link'
import { Alert } from '@/src/components/ui/alert'
import { EntradaSemReserva } from './entrada-sem-reserva'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { lerFiltros } from '@/src/features/prospeccao/filtros'
import { urlConsulta } from './localizar/navegacao'

export default async function PaginaFila({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const eu = await exigir('usuario')
  const entrada = lerFiltros(await searchParams)
  if (!entrada.ok) return <main className="p-6"><p role="alert">Filtros inválidos. A busca não foi executada.</p><Link href="/fila">Limpar filtros</Link></main>
  const r = await lerMinhasEmpresas(eu.usuarioId)
  // O histórico só é buscado quando há reserva: sem empresa na mão, não há
  // linha do tempo para mostrar, e a ida ao banco não se paga.
  const historico = r.ok && r.reserva ? await lerHistorico(eu.usuarioId, r.reserva.id) : null
  const contatos = historico?.ok ? historico.contatos : []
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Atendimento</h1>
        <nav className="flex items-center gap-3">
          <Link href={urlConsulta(entrada.filtros,1)} className="text-sm underline">
            Localizar empresa
          </Link>
        </nav>
      </header>
      {r.ok ? (
        r.reserva ? <Formulario reserva={r.reserva} contatos={contatos} contexto={r.contexto} filtros={entrada.filtros} />
          : <EntradaSemReserva contexto={r.contexto} filtros={entrada.filtros} />
      ) : (
        <Alert variant="warning">{textoDoMotivo(r.motivo)}</Alert>
      )}
    </main>
  )
}
