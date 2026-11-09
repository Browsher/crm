'use client'

import { useState, type ReactNode } from 'react'
import { TabsIndicator, TabsList, TabsPanel, TabsRoot, TabsTab } from '@/src/components/ui/tabs'

type Aba = 'buscar' | 'historico'

export function AbasBanco({ buscaId, buscar, historico }: { buscaId?: string; buscar: ReactNode; historico: ReactNode }) {
  const [selecao, setSelecao] = useState<{ buscaId?: string; aba: Aba }>({ buscaId, aba: 'buscar' })
  if (selecao.buscaId !== buscaId) {
    setSelecao({ buscaId, aba: buscaId ? 'buscar' : selecao.aba })
  }
  const { aba } = selecao

  return <TabsRoot value={aba} onValueChange={valor => {
    if (valor === 'buscar' || valor === 'historico') setSelecao({ buscaId, aba: valor })
  }}>
    <TabsList aria-label="Banco de empresas" className="flex-wrap">
      <TabsTab value="buscar">Buscar empresas</TabsTab>
      <TabsTab value="historico">Histórico de buscas</TabsTab>
      <TabsIndicator />
    </TabsList>
    <TabsPanel value="buscar" keepMounted>{buscar}</TabsPanel>
    <TabsPanel value="historico">
      {/* O portal do Histórico precisa desmontar na mesma troca que abre o resultado novo. */}
      {aba === 'historico' && historico}
    </TabsPanel>
  </TabsRoot>
}
