'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'

export type Edicao = { alterado: boolean; pendente: boolean; fechar: () => void }
export type InformarEdicao = (edicao: Edicao | null) => void
type Destino = 'semana' | 'dialogo' | 'voltar' | { href: string }

export function useGuardaEdicao(semana: Edicao | null, dialogo: Edicao | null) {
  const router = useRouter()
  const [destino, setDestino] = useState<Destino | null>(null)
  const foco = useRef<HTMLElement | null>(null)
  const botaoContinuar = useRef<HTMLButtonElement>(null)
  const protegido = !!(semana?.alterado || semana?.pendente || dialogo?.alterado || dialogo?.pendente)
  const pendente = !!(semana?.pendente || dialogo?.pendente)
  const atual = useRef({ protegido, pendente, dialogo, destino, semana, router })
  const sentinela = useRef<string | null>(null)
  const retirando = useRef(false)
  const voltando = useRef(false)
  const hrefAposRetirada = useRef<string | null>(null)
  const frame = useRef<number | null>(null)

  function armar() {
    const marca = sentinela.current ?? crypto.randomUUID()
    sentinela.current = marca
    history.pushState({ ...history.state, __edicaoGoogle: marca }, '', location.href)
  }

  function retirar() {
    sentinela.current = null
    retirando.current = true
    history.back()
  }

  function pedir(alvo: Destino) {
    const { protegido, pendente, destino, dialogo, semana } = atual.current
    if (pendente || destino) return
    const edicao = alvo === 'semana' ? semana : alvo === 'dialogo' ? dialogo : null
    if (edicao ? edicao.alterado : protegido) {
      foco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setDestino(alvo)
    } else {
      edicao?.fechar()
    }
  }

  useLayoutEffect(() => {
    atual.current = { protegido, pendente, dialogo, destino, semana, router }
    if (retirando.current || voltando.current || hrefAposRetirada.current) return
    if (protegido && !sentinela.current) armar()
    if (!protegido && sentinela.current) retirar()
  })

  useLayoutEffect(() => {
    const voltar = (evento: PopStateEvent) => {
      if (voltando.current) {
        voltando.current = false
        return
      }
      if (retirando.current) {
        retirando.current = false
        if (atual.current.protegido && !hrefAposRetirada.current) armar()
        if (hrefAposRetirada.current) {
          // O App Router também processa o popstate. A navegação só começa
          // depois que todos os listeners nativos tiveram sua vez.
          frame.current = requestAnimationFrame(() => {
            frame.current = null
            const href = hrefAposRetirada.current
            hrefAposRetirada.current = null
            if (!href) return
            if (atual.current.protegido) {
              if (!sentinela.current) armar()
              pedir({ href })
              return
            }
            atual.current.router.push(href)
          })
        }
        return
      }
      if (!sentinela.current || evento.state?.__edicaoGoogle === sentinela.current) return
      armar()
      pedir('voltar')
    }
    const tecla = (evento: KeyboardEvent) => {
      if (evento.defaultPrevented || evento.key !== 'Escape' || !atual.current.semana || atual.current.dialogo || atual.current.destino) return
      pedir('semana')
    }
    const guardarLink = (evento: MouseEvent) => {
      const link = evento.target instanceof Element ? evento.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.altKey || evento.shiftKey
        || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
      if (!atual.current.protegido && !retirando.current && frame.current === null) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) return
      if (url.href === location.href) return
      const href = url.pathname.startsWith('//') ? url.href : url.pathname + url.search + url.hash
      evento.preventDefault()
      if (atual.current.protegido) pedir({ href })
      else hrefAposRetirada.current = href
    }
    document.addEventListener('click', guardarLink, true)
    document.addEventListener('keydown', tecla)
    window.addEventListener('popstate', voltar)
    return () => {
      document.removeEventListener('click', guardarLink, true)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('popstate', voltar)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      hrefAposRetirada.current = null
    }
  }, [])

  useLayoutEffect(() => {
    if (!protegido) return
    const unload = (evento: BeforeUnloadEvent) => {
      if (voltando.current) return
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [protegido])

  function descartar() {
    setDestino(null)
    if (destino === 'semana') return semana?.fechar()
    if (destino === 'dialogo') return dialogo?.fechar()
    dialogo?.fechar()
    semana?.fechar()
    if (destino === 'voltar') {
      // Os dois editores podem desmontar em commits diferentes. Não
      // rearme a sentinela entre a confirmação e a travessia autorizada.
      if (history.length < 3) return
      voltando.current = true
      sentinela.current = null
      history.go(-2)
    } else if (destino) {
      if (!sentinela.current && !retirando.current) {
        router.push(destino.href)
        return
      }
      hrefAposRetirada.current = destino.href
      if (sentinela.current) retirar()
    }
  }

  const tema = useTemaCrm()
  const confirmacao = <Dialog open={destino !== null} onOpenChange={aberto => { if (!aberto) setDestino(null) }}>
    <DialogContent theme={tema} showCloseButton={false}
      onOpenAutoFocus={evento => { evento.preventDefault(); botaoContinuar.current?.focus() }}
      onCloseAutoFocus={evento => { evento.preventDefault(); if (foco.current?.isConnected) foco.current.focus() }}>
      <DialogHeader><DialogTitle>Descartar alterações?</DialogTitle><DialogDescription>As alterações locais serão perdidas.</DialogDescription></DialogHeader>
      <DialogFooter>
        <Button ref={botaoContinuar} type="button" onClick={() => setDestino(null)}>Continuar editando</Button>
        <Button type="button" variant="outline" onClick={descartar}>Descartar alterações</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  return { pedir, confirmacao }
}
