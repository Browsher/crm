import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { Acesso } from '@/src/components/crm/acesso'

// Usuário logado não vê o login. É a página, não o proxy, que decide: cookie
// inválido cai aqui e o formulário sobrescreve.
export default async function PaginaLogin() {
  if (await usuarioAtual()) redirect('/')
  return (
    <Acesso titulo="Entrar" descricao="Acesse sua conta para continuar.">
      <Formulario />
    </Acesso>
  )
}
