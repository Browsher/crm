import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'

export default async function PaginaImportarEmpresas() {
  await exigir('gestor')
  redirect('/empresas')
}
