'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGuardaPainelEdicao } from '@/src/components/crm/guarda-painel-edicao'

export function RedirecionarAtendimento({ destino }: { destino: string }) {
  const router = useRouter()
  const iniciou = useRef(false)
  // No reload, a guarda precisa reconhecer a entrada na URL da lateral
  // antes de trocar para a rota canônica.
  const { restaurando } = useGuardaPainelEdicao(false, false, () => false, () => {})

  useEffect(() => {
    if (restaurando || iniciou.current) return
    iniciou.current = true
    router.replace(destino)
  }, [destino, restaurando, router])

  return <p role="status">Abrindo atendimento…</p>
}
