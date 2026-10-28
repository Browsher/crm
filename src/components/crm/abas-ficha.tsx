'use client'

import type { ReactNode } from 'react'
import { TabsRoot, TabsList, TabsTab, TabsPanel, TabsIndicator } from '@/src/components/ui/tabs'

export function AbasFicha({ dados, historico }: { dados: ReactNode; historico: ReactNode }) {
  return <TabsRoot defaultValue="dados"><TabsList aria-label="Informações da empresa"><TabsTab value="dados">Dados da empresa</TabsTab><TabsTab value="historico">Histórico</TabsTab><TabsIndicator /></TabsList><TabsPanel value="dados" keepMounted className="text-foreground">{dados}</TabsPanel><TabsPanel value="historico" keepMounted className="text-foreground">{historico}</TabsPanel></TabsRoot>
}
