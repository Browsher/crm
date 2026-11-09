'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/src/components/ui/dialog'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'

export function ConsultaInterceptada({ titulo, children }: { titulo: string; children: ReactNode }) {
  const router = useRouter()
  const [gatilho] = useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  return <Dialog open>
    <PainelSobrepostoCrm titulo={titulo} descricao="Consulta da Carteira" aoFechar={() => router.back()}
      onCloseAutoFocus={evento => {
        evento.preventDefault()
        if (gatilho?.isConnected) gatilho.focus({ preventScroll: true })
      }}>
      <div className="grid gap-4">{children}</div>
    </PainelSobrepostoCrm>
  </Dialog>
}
