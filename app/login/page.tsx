import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'

// Usuário logado não vê o login. É a página, não o proxy, que decide: cookie
// inválido cai aqui e o formulário sobrescreve.
export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect('/')
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <Formulario />
    </main>
  )
}
