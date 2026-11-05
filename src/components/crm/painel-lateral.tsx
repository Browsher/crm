'use client'

import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/src/components/ui/button'
import styles from './painel-lateral.module.css'

type Props = {
  titulo: string
  descricao?: ReactNode
  rotulo?: string
  aoFechar: () => void
  children: ReactNode
  id?: string
  fecharBloqueado?: boolean
  className?: string
}

export function PainelLateralCrm({ titulo, descricao, rotulo, aoFechar, children, id, fecharBloqueado = false, className }: Props) {
  const tituloId = useId()
  const cabecalho = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const alvo = cabecalho.current
    if (!alvo) return
    alvo.focus({ preventScroll: true })
    if (window.matchMedia?.('(max-width: 1120px)').matches) alvo.scrollIntoView?.({ block: 'nearest' })
  }, [])

  return <aside id={id} data-painel-lateral aria-label={rotulo} aria-labelledby={rotulo ? undefined : tituloId}
    className={[styles.painel, className].filter(Boolean).join(' ')} onKeyDown={evento => {
      if (evento.key !== 'Escape' || evento.defaultPrevented || !evento.currentTarget.contains(evento.target as Node)) return
      evento.preventDefault()
      evento.stopPropagation()
      if (!fecharBloqueado) aoFechar()
    }}>
    <header className={styles.cabecalho}>
      <div><h2 id={tituloId} ref={cabecalho} tabIndex={-1}>{titulo}</h2>{descricao && <div className={styles.descricao}>{descricao}</div>}</div>
      <Button type="button" variant="outline" size="sm" disabled={fecharBloqueado} onClick={aoFechar}>Fechar</Button>
    </header>
    <div className={styles.corpo}>{children}</div>
  </aside>
}
