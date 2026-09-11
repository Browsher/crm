'use client'
import { createContext, useContext } from 'react'
export type TemaCrm = 'light' | 'dark' | 'system'
export const TemaCrmContext = createContext<TemaCrm>('system')
export function useTemaCrm() { return useContext(TemaCrmContext) }
