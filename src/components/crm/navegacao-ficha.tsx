'use client'

import Link from 'next/link'
import { createContext, useContext, type ComponentProps } from 'react'

export const FechamentoFichaContexto = createContext<(() => void) | null>(null)

export function LinkInternoFicha(props: ComponentProps<typeof Link>) {
  const fechar = useContext(FechamentoFichaContexto)
  return <Link {...props} onNavigate={fechar ?? undefined} />
}
