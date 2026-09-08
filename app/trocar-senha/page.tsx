import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'

export default async function PaginaTrocarSenha() {
  const eu = await exigir('sessao')
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Trocar senha</h1>
      {eu.senhaProvisoriaPendente && <p className="text-sm">Sua senha é provisória. Escolha uma definitiva para continuar.</p>}
      <Formulario />
    </main>
  )
}
