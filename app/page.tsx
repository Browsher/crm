import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'

export default async function Inicio() {
  const eu = await exigir('usuario')
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CRM</h1>
        <nav className="flex items-center gap-3">
          {eu.papel === 'gestor' && (
            <Link href="/usuarios" className="text-sm underline">
              Usuários
            </Link>
          )}
          <form action="/sair" method="post">
            <button type="submit" className="rounded border px-3 py-1 text-sm">
              Sair
            </button>
          </form>
        </nav>
      </header>
      <p>
        Olá, {eu.nome}. Você é {eu.papel}.
      </p>
    </main>
  )
}
