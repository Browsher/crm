'use client'

import { useEffect, useRef, useState } from 'react'
import { registrarVisitaAcao } from './registrar-visita-acao'

export function RegistrarVisita({ empresaId }: { empresaId: string }) {
  const registrada = useRef<{ empresaId: string } | null>(null)
  const [aviso, setAviso] = useState<{ id: string; erro: string | null } | null>(null)
  useEffect(() => {
    // Revalidação atualiza o RSC da mesma página. Não registrar de novo por isso.
    if (registrada.current?.empresaId === empresaId) return
    const visita = { empresaId }
    registrada.current = visita
    void registrarVisitaAcao(empresaId).then(r => {
      if (registrada.current !== visita) return
      setAviso({ id: empresaId, erro: r.erro })
    }).catch(() => {
      if (registrada.current !== visita) return
      setAviso({ id: empresaId, erro: 'Não foi possível atualizar as empresas recentes.' })
    })
  }, [empresaId])
  return aviso?.id === empresaId && aviso.erro ? <p role="alert" className="text-sm">{aviso.erro}</p> : null
}
