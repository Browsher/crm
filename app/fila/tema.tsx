'use client'

import { createContext, useContext } from 'react'

export type TemaFila = 'light' | 'dark' | 'system'
export const TemaFilaContext = createContext<TemaFila>('system')
export function useTemaFila() { return useContext(TemaFilaContext) }
