'use client'

import Link from 'next/link'
import { rascunhoAlterado } from '@/src/features/contato/rascunho'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { useRascunhos } from './rascunhos'
import { Formulario } from './formulario'
import { selecionarGrupo, urlConsulta } from './localizar/navegacao'

export function EntradaSemReserva({ filtros, contexto }: { filtros: Filtros; contexto: string | null }) {
  const { entradas } = useRascunhos()
  const preservar = Object.values(entradas).some(entrada => entrada.expirada || rascunhoAlterado(entrada.valor))
  const destino = urlConsulta(filtros, filtros.pagina)
  if (preservar) return <Formulario reserva={null} contatos={[]} contexto={contexto} filtros={filtros} />
  return <div className="flex flex-wrap gap-4"><Link href={urlConsulta(selecionarGrupo(null),1)} className="underline">Todas as listas ativas</Link><Link href={destino} className="underline">Localizar empresa</Link></div>
}
