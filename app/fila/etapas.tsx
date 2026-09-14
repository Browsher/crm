'use client'

import Link from 'next/link'
import { Etapas } from '@/src/components/crm/etapas'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { urlConsulta } from './localizar/navegacao'

export function EtapasFila({ etapa, filtros, onConsultar, bloqueado = false }: {
  etapa: 'puxar' | 'consultar' | 'registrar'
  filtros: Filtros
  onConsultar?: () => void
  bloqueado?: boolean
}) {
  return <Etapas rotulo="Etapas da prospecção" atual={etapa} itens={[
    {
      id: 'puxar', rotulo: 'Puxar',
      acao: etapa !== 'puxar' && !bloqueado
        ? <Link href={urlConsulta(filtros, filtros.pagina)}>Puxar</Link> : undefined,
    },
    {
      id: 'consultar', rotulo: 'Consultar',
      acao: etapa === 'registrar' && onConsultar && !bloqueado
        ? <button type="button" onClick={onConsultar}>Consultar</button> : undefined,
    },
    { id: 'registrar', rotulo: 'Registrar' },
  ]} />
}
