import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'

export default async function Inicio() {
  await exigir('usuario')
  redirect('/meu-dia')
}
