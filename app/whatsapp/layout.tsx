import type { ReactNode } from 'react'
import { exigir } from '@/src/server/autenticacao/guarda'
import { ShellCrm } from '@/src/components/crm/shell'
import '@/src/styles/ui.css'

export default async function LayoutWhatsApp({ children }: { children: ReactNode }) {
  const eu = await exigir('gestor')
  return <ShellCrm nome={eu.nome} papel={eu.papel} area="whatsapp">{children}</ShellCrm>
}
