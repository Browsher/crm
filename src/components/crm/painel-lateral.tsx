'use client'

import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/src/components/ui/button'
import { usePainelMovel } from './use-painel-movel'
import styles from './painel-lateral.module.css'

type Props = {
  titulo: string
  descricao?: ReactNode
  rotulo?: string
  aoFechar: () => void
  children: ReactNode
  id?: string
  rotuloFechar?: 'Fechar' | 'Voltar'
  fecharBloqueado?: boolean
  className?: string
  rodape?: ReactNode
  ocupado?: boolean
}

export function PainelLateralCrm({ titulo, descricao, rotulo, aoFechar, children, id, fecharBloqueado = false, className, rotuloFechar = 'Fechar', rodape, ocupado = false }: Props) {
  const tituloId = useId()
  const raiz = useRef<HTMLElement>(null)
  const cabecalho = useRef<HTMLHeadingElement>(null)
  usePainelMovel(raiz, true)
  useLayoutEffect(() => {
    const alvo = cabecalho.current
    if (!alvo) return
    alvo.focus({ preventScroll: true })
  }, [])

  return <aside ref={raiz} id={id} data-painel-lateral data-painel-composicao="padrao" aria-label={rotulo} aria-labelledby={rotulo ? undefined : tituloId}
    className={[styles.painel, className].filter(Boolean).join(' ')} onKeyDown={evento => {
      if (evento.key !== 'Escape' || evento.defaultPrevented || !evento.currentTarget.contains(evento.target as Node)) return
      evento.preventDefault()
      evento.stopPropagation()
      if (!fecharBloqueado) aoFechar()
    }}>
    <header className={styles.cabecalho}>
      <div><h2 id={tituloId} ref={cabecalho} tabIndex={-1}>{titulo}</h2>{descricao && <div className={styles.descricao}>{descricao}</div>}</div>
      <Button type="button" variant="outline" size="sm" disabled={fecharBloqueado} onClick={() => { if (!fecharBloqueado) aoFechar() }}>{rotuloFechar}</Button>
    </header>
    <div className={styles.corpo} data-painel-corpo aria-busy={ocupado}>{children}</div>
    {rodape != null && <footer className={styles.rodape} data-painel-rodape>{rodape}</footer>}
  </aside>
}
