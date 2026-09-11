import type { ReactNode } from 'react'
import { ShellCrm } from '@/src/components/crm/shell'
import { exigir } from '@/src/server/autenticacao/guarda'
import '@/src/styles/ui.css'

export default async function LayoutCarteira({ children }: { children: ReactNode }) {
  const eu = await exigir('usuario')
  return <ShellCrm nome={eu.nome} papel={eu.papel} area="carteira">{children}</ShellCrm>
}
