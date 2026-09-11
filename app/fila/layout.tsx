import type { ReactNode } from 'react'
import { RascunhosProvider } from './rascunhos'
export default function LayoutFila({ children }: { children: ReactNode }) {
  return <RascunhosProvider>{children}</RascunhosProvider>
}
