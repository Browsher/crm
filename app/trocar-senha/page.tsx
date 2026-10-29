import { exigir } from '@/src/server/autenticacao/guarda'
import { Formulario } from './formulario'
import { Acesso } from '@/src/components/crm/acesso'
import { Alert } from '@/src/components/ui/alert'

export default async function PaginaTrocarSenha() {
  const eu = await exigir('sessao')
  return (
    <Acesso titulo="Trocar senha" descricao="Escolha uma senha para proteger sua conta.">
      {eu.senhaProvisoriaPendente && <Alert className="mb-6">Sua senha é provisória. Escolha uma definitiva para continuar.</Alert>}
      <Formulario />
    </Acesso>
  )
}
