'use client'

import Link from 'next/link'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { urlConsulta } from './localizar/navegacao'
import styles from './shell.module.css'

export function EtapasFila({ etapa, filtros, onConsultar, bloqueado = false }: {
  etapa: 'puxar' | 'consultar' | 'registrar'
  filtros: Filtros
  onConsultar?: () => void
  bloqueado?: boolean
}) {
  return <nav aria-label="Etapas da prospecção" className={styles.etapas}>
    <div aria-current={etapa === 'puxar' ? 'step' : undefined}>
      {etapa !== 'puxar' && !bloqueado ? <Link href={urlConsulta(filtros, filtros.pagina)}>Puxar</Link> : <span>Puxar</span>}
    </div>
    <div aria-current={etapa === 'consultar' ? 'step' : undefined}>
      {etapa === 'registrar' && onConsultar && !bloqueado ? <button type="button" onClick={onConsultar}>Consultar</button> : <span>Consultar</span>}
    </div>
    <div aria-current={etapa === 'registrar' ? 'step' : undefined}><span>Registrar</span></div>
  </nav>
}
