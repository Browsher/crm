import Link from 'next/link'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { ListaCarteira } from './lista'

export default async function PaginaCarteira() {
  const eu = await exigir('usuario')
  const r = await lerMinhasEmpresas(eu.usuarioId)
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minha carteira</h1>
        <nav className="flex items-center gap-3">
          <Link href="/fila" className="text-sm underline">
            Fila
          </Link>
          <Link href="/" className="text-sm underline">
            Início
          </Link>
        </nav>
      </header>
      {r.ok ? (
        <>
          <p className="text-sm text-neutral-600">
            {r.carteira.length} {r.carteira.length === 1 ? 'empresa' : 'empresas'}
          </p>
          <ListaCarteira linhas={r.carteira} />
        </>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{textoDoMotivo(r.motivo)}</p>
      )}
    </main>
  )
}
