import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Ficha } from './ficha'

// `params` tipado na mão, nunca com tipo gerado pelo build (R-004): o typecheck
// do CI roda sem `next build`.
export default async function PaginaFicha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const eu = await exigir('usuario')
  const r = await lerMinhasEmpresas(eu.usuarioId)

  if (!r.ok) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{textoDoMotivo(r.motivo)}</p>
      </main>
    )
  }

  // Empresa fora da carteira é 404, e não "sem permissão": a existência dela
  // não é informação que o vendedor deva receber.
  const empresa = r.carteira.find((e) => e.id === id)
  if (!empresa) notFound()

  const historico = await lerHistorico(eu.usuarioId, id)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ficha</h1>
        <nav className="flex items-center gap-3">
          <Link href="/carteira" className="text-sm underline">
            Carteira
          </Link>
          <Link href="/fila" className="text-sm underline">
            Fila
          </Link>
        </nav>
      </header>
      <Ficha empresa={empresa} contatos={historico.ok ? historico.contatos : []} />
    </main>
  )
}
