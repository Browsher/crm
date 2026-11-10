'use client'

import { createContext } from 'react'

export type ControladorAtendimento = {
  prefixoAcao: string
  abrir: (empresaId: string, idAcao: string) => void
  atualizar: () => void
  bloqueado: boolean
  consultaBloqueada: boolean
  travarComando: (idAcao: string) => { estaAtivo: () => boolean; liberar: () => void } | null
}

export const ContextoAtendimentoLista = createContext<ControladorAtendimento | null>(null)
