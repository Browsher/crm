import '@/src/styles/ui.css'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Galeria } from './galeria'

export default async function PaginaDesign() {
  await exigir('gestor')

  return <Galeria />
}
