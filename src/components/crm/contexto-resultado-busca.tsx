'use client'

import { createContext } from 'react'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'

export const ContextoResultadoBusca = createContext<{
  verEmpresa: (referencia: ReferenciaEmpresa, gatilho: HTMLButtonElement) => void
  rodape: HTMLDivElement | null
} | null>(null)
