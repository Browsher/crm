'use client'

import { createContext } from 'react'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import type { ControladorAtendimento } from './contexto-atendimento'

export const ContextoResultadoBusca = createContext<{
  verEmpresa: (referencia: ReferenciaEmpresa, gatilho: HTMLButtonElement) => void
  rodape: HTMLDivElement | null
  atendimento?: ControladorAtendimento & { registrarInclusao: (pendente: boolean) => void }
} | null>(null)
