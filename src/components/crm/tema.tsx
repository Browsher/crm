'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
export type TemaCrm = 'light' | 'dark' | 'system'
export const TemaCrmContext = createContext<TemaCrm>('system')
const ControleTemaContext = createContext<{ tema: TemaCrm; definirTema: (tema: TemaCrm) => void } | null>(null)
export function useTemaCrm() { return useContext(TemaCrmContext) }

export function useControleTemaCrm() {
  const controle = useContext(ControleTemaContext)
  const [tema, definirTema] = useState<TemaCrm>('system')
  return controle ?? { tema, definirTema }
}

export function TemaCrmProvider({ children }: { children: ReactNode }) {
  const [tema, definirTema] = useState<TemaCrm>('system')
  useEffect(() => {
    const raiz = document.documentElement
    const anterior = raiz.dataset.theme
    const preferencia = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined
    const atualizar = () => { raiz.dataset.theme = tema === 'system' ? (preferencia?.matches ? 'dark' : 'light') : tema }
    atualizar()
    preferencia?.addEventListener('change', atualizar)
    return () => {
      preferencia?.removeEventListener('change', atualizar)
      if (anterior === undefined) delete raiz.dataset.theme
      else raiz.dataset.theme = anterior
    }
  }, [tema])
  return <ControleTemaContext.Provider value={{ tema, definirTema }}><TemaCrmContext.Provider value={tema}>{children}</TemaCrmContext.Provider></ControleTemaContext.Provider>
}
