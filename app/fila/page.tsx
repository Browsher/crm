import Link from 'next/link'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'

export default async function PaginaFila() {
  const eu = await exigir('usuario')
  const r = await lerMinhasEmpresas(eu.usuarioId)
  // O histórico só é buscado quando há reserva: sem empresa na mão, não há
  // linha do tempo para mostrar, e a ida ao banco não se paga.
  const historico = r.ok && r.reserva ? await lerHistorico(eu.usuarioId, r.reserva.id) : null
  const contatos = historico?.ok ? historico.contatos : []
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fila</h1>
        <nav className="flex items-center gap-3">
          <Link href="/fila/localizar" className="text-sm underline">
            Localizar empresa
          </Link>
          <Link href="/carteira" className="text-sm underline">
            Carteira
          </Link>
          <Link href="/" className="text-sm underline">
            Início
          </Link>
        </nav>
      </header>
      {r.ok ? (
        <Formulario reserva={r.reserva} contatos={contatos} />
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{textoDoMotivo(r.motivo)}</p>
      )}
    </main>
  )
}
