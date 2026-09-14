import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'

export default async function Inicio() {
  const eu = await exigir('usuario')
  redirect(eu.papel === 'gestor' ? '/gestao' : '/meu-dia')
}
