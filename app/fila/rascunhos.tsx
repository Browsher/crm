'use client'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { rascunhoInicial, type RascunhoContato } from '@/src/features/contato/rascunho'
type Entrada = { nome: string; valor: RascunhoContato; expirada?: boolean }
type Estado = {
  entradas: Record<string, Entrada>
  atualizar: (id: string, nome: string, valor: RascunhoContato) => void
  limpar: (id: string) => void
  marcarExpirada: (id: string, nome: string) => void
  gravando: boolean
  setGravando: (valor: boolean) => void
}
const Contexto = createContext<Estado>({ entradas: {}, atualizar: () => {}, limpar: () => {}, marcarExpirada: () => {}, gravando: false, setGravando: () => {} })
// Memória da área Fila, inclusive ao navegar para Localizar. Sem persistência
// no navegador e sem reusar contatos/histórico de uma reserva antiga.
export function RascunhosProvider({ children }: { children: ReactNode }) {
  const [entradas, setEntradas] = useState<Record<string, Entrada>>({})
  const [gravando, setGravando] = useState(false)
  return <Contexto.Provider value={{ entradas, gravando, setGravando,
    atualizar: (id,nome,valor) => setEntradas(antes => ({ ...antes, [id]: { ...antes[id], nome, valor } })),
    marcarExpirada: (id,nome) => setEntradas(antes => ({ ...antes, [id]: { nome, valor: antes[id]?.valor ?? rascunhoInicial(false), expirada: true } })),
    limpar: id => setEntradas(antes => { const copia = { ...antes }; delete copia[id]; return copia }),
  }}>{children}</Contexto.Provider>
}
export function useRascunhos() { return useContext(Contexto) }
