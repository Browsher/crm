'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import type { RascunhoContato } from '@/src/features/contato/rascunho'
type Entrada = { nome: string; valor: RascunhoContato }
type Estado = {
  entradas: Record<string, Entrada>
  atualizar: (id: string, nome: string, valor: RascunhoContato) => void
  limpar: (id: string) => void
}
const Contexto = createContext<Estado>({ entradas: {}, atualizar: () => {}, limpar: () => {} })
// Memória por empresa entre rotas. O editor persiste a própria sessão da aba.
export function RascunhosProvider({ children }: { children: ReactNode }) {
  const [entradas, setEntradas] = useState<Record<string, Entrada>>({})
  return <Contexto.Provider value={{ entradas,
    atualizar: (id,nome,valor) => setEntradas(antes => ({ ...antes, [id]: { ...antes[id], nome, valor } })),
    limpar: id => setEntradas(antes => { const copia = { ...antes }; delete copia[id]; return copia }),
  }}>{children}</Contexto.Provider>
}
export function useRascunhos() { return useContext(Contexto) }
