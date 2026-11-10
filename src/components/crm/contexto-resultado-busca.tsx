'use client'

import { createContext } from 'react'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'

export const ContextoResultadoBusca = createContext<{
  verEmpresa: (referencia: ReferenciaEmpresa, gatilho: HTMLButtonElement) => void
  rodape: HTMLDivElement | null
  atendimento?: {
    prefixoAcao: string
    abrir: (empresaId: string, idAcao: string) => void
    atualizar: () => void
    bloqueado: boolean
    consultaBloqueada: boolean
    travarComando: () => { estaAtivo: () => boolean; liberar: () => void } | null
    registrarInclusao: (pendente: boolean) => void
  }
} | null>(null)
