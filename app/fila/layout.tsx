import type { ReactNode } from 'react'
import { RascunhosProvider } from './rascunhos'
import { exigir } from '@/src/server/autenticacao/guarda'
import { ShellFila } from './shell'
import '@/src/styles/ui.css'
export default async function LayoutFila({ children }: { children: ReactNode }) {
  const eu = await exigir('usuario')
  return <RascunhosProvider><ShellFila nome={eu.nome} papel={eu.papel}>{children}</ShellFila></RascunhosProvider>
}
