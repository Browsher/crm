import type { ReactNode } from 'react'

export default function LayoutLocalizar({ children, atendimento }: { children: ReactNode; atendimento: ReactNode }) {
  return <>{children}{atendimento}</>
}
