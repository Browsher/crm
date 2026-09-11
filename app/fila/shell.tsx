'use client'
import type { ReactNode } from 'react'
import { ShellCrm } from '@/src/components/crm/shell'
export function ShellFila(props: { children: ReactNode; nome: string; papel: 'gestor' | 'vendedor' }) {
  return <ShellCrm {...props} area="fila" />
}