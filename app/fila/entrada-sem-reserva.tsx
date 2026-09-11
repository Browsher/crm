'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { rascunhoAlterado } from '@/src/features/contato/rascunho'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { useRascunhos } from './rascunhos'
import { Formulario } from './formulario'
import { urlConsulta } from './localizar/navegacao'

export function EntradaSemReserva({ filtros, contexto }: { filtros: Filtros; contexto: string | null }) {
  const { entradas } = useRascunhos()
  const router = useRouter()
  const preservar = Object.values(entradas).some(entrada => entrada.expirada || rascunhoAlterado(entrada.valor))
  const destino = urlConsulta(filtros, filtros.pagina)
  useEffect(() => {
    if (!preservar) router.replace(destino)
  }, [preservar, destino, router])
  if (preservar) return <Formulario reserva={null} contatos={[]} contexto={contexto} filtros={filtros} />
  return <p role="status">Abrindo a busca. <Link href={destino}>Localizar empresa</Link></p>
}
