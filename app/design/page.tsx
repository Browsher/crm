import '@/src/styles/ui.css'
import { exigir } from '@/src/server/autenticacao/guarda'
import { ShellCrm } from '@/src/components/crm/shell'
import { Galeria } from './galeria'

export default async function PaginaDesign() {
  const eu = await exigir('gestor')

  return <ShellCrm nome={eu.nome} papel={eu.papel} area="design"><Galeria /></ShellCrm>
}
