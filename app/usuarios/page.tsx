import Link from 'next/link'
import { acoesDe, gestorUnico } from '@/src/features/usuarios/regras'
import { repositorioPostgres } from '@/src/features/usuarios/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { FormularioCriar } from './formulario-criar'
import { Linha } from './linha'

export default async function PaginaUsuarios() {
  const eu = await exigir('gestor')
  const lista = await repositorioPostgres(eu.usuarioId).listar()
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <Link href="/" className="text-sm underline">
          Início
        </Link>
      </header>
      {gestorUnico(lista) && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Você é o único gestor ativo. Se perder o acesso, a recuperação é pelo seed.
        </p>
      )}
      <FormularioCriar />
      <ul>
        {lista.map((u) => (
          <Linha key={u.id} usuario={u} acoes={acoesDe(u, eu.usuarioId)} souEu={u.id === eu.usuarioId} />
        ))}
      </ul>
    </main>
  )
}
