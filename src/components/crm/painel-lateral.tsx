'use client'

import { useId, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@/src/components/ui/button'
import { DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { usePainelMovel } from './use-painel-movel'
import { useTemaCrm } from './tema'
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

type PropsMoldura = Pick<Props, 'children' | 'rodape' | 'ocupado' | 'aoFechar' | 'rotuloFechar' | 'fecharBloqueado'> & {
  titulo: ReactNode
  descricao?: ReactNode
}

function MolduraPainel({ titulo, descricao, aoFechar, children, rodape, fecharBloqueado = false, rotuloFechar = 'Fechar', ocupado = false }: PropsMoldura) {
  return <>
    <header className={styles.cabecalho}>
      <div>{titulo}{descricao}</div>
      <Button type="button" variant="outline" size="sm" disabled={fecharBloqueado} onClick={() => { if (!fecharBloqueado) aoFechar() }}>{rotuloFechar}</Button>
    </header>
    <div className={styles.corpo} data-painel-corpo aria-busy={ocupado}>{children}</div>
    {rodape != null && <footer className={styles.rodape} data-painel-rodape>{rodape}</footer>}
  </>
}

export function PainelLateralCrm({ titulo, descricao, rotulo, id, className, ...moldura }: Props) {
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
      if (!moldura.fecharBloqueado) moldura.aoFechar()
    }}>
    <MolduraPainel {...moldura} titulo={<h2 id={tituloId} ref={cabecalho} tabIndex={-1}>{titulo}</h2>}
      descricao={descricao && <div className={styles.descricao}>{descricao}</div>} />
  </aside>
}

type PropsSobreposto = Props & {
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus']
}

export function PainelSobrepostoCrm({ titulo, descricao, rotulo, id, className, onCloseAutoFocus, ...moldura }: PropsSobreposto) {
  const cabecalho = useRef<HTMLHeadingElement>(null)
  const tema = useTemaCrm()

  function pedirFechamento(evento: Event) {
    if (evento.defaultPrevented) return
    evento.preventDefault()
    if (!moldura.fecharBloqueado) moldura.aoFechar()
  }

  return <DialogContent lateral theme={tema} showCloseButton={false}
    data-painel-lateral data-painel-composicao="padrao"
    {...(id ? { id } : {})}
    {...(rotulo ? { 'aria-label': rotulo, 'aria-labelledby': undefined } : {})}
    className={[styles.painel, className].filter(Boolean).join(' ')}
    onOpenAutoFocus={evento => {
      evento.preventDefault()
      cabecalho.current?.focus({ preventScroll: true })
    }}
    onCloseAutoFocus={onCloseAutoFocus} onEscapeKeyDown={pedirFechamento} onInteractOutside={pedirFechamento}>
    <MolduraPainel {...moldura} titulo={<DialogTitle ref={cabecalho} tabIndex={-1}>{titulo}</DialogTitle>}
      descricao={descricao && <DialogDescription asChild><div className={styles.descricao}>{descricao}</div></DialogDescription>} />
  </DialogContent>
}
