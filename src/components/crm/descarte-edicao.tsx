'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { useTemaCrm } from './tema'

type Pedido = (continuar: () => void) => void
type Editor = { pendente: boolean; pedir: Pedido }
const editores = new Map<symbol, Editor>()
const guardasDeNavegacao = new Map<symbol, Editor & { ativa: () => boolean }>()

function atualizarGuardaDeLinks() {
  if (editores.size || guardasDeNavegacao.size) document.addEventListener('click', guardarLink, true)
  else document.removeEventListener('click', guardarLink, true)
}

function editoresAtivos() {
  return [...editores.values(), ...[...guardasDeNavegacao.values()].filter(guarda => guarda.ativa())]
}

const MARCA = '__crmEdicaoAdministrativa'
let sentinela: { id: string; href: string } | null = null
let retirando = false
let depoisDeRetirar: (() => void) | null = null
let saidaAutorizada = false

// Uma entrada por página, mesmo quando mais de um formulário tem rascunho.
// O marcador contém somente um identificador da entrada, nunca os campos.
function armarVoltar() {
  if (retirando || sentinela) return
  const restaurada = history.state?.[MARCA]
  const id = typeof restaurada === 'string' ? restaurada : crypto.randomUUID()
  sentinela = { id, href: location.href }
  if (restaurada !== id) history.pushState({ ...history.state, [MARCA]: id }, '', location.href)
}

function retirarVoltar(continuar?: () => void) {
  if (retirando) {
    if (continuar) depoisDeRetirar = continuar
    return
  }
  if (!sentinela || history.state?.[MARCA] !== sentinela.id) {
    sentinela = null
    continuar?.()
    return
  }
  sentinela = null
  retirando = true
  depoisDeRetirar = continuar ?? null
  history.back()
}

function aoVoltar() {
  if (retirando) {
    retirando = false
    const continuar = depoisDeRetirar
    depoisDeRetirar = null
    if (continuar) requestAnimationFrame(continuar)
    else if (editores.size) armarVoltar()
    else desligarGuarda()
    return
  }
  if (!sentinela || history.state?.[MARCA] === sentinela.id) return
  const origem = sentinela
  sentinela = null
  if (location.href !== origem.href) return
  armarVoltar()
  pedirSaidaDaEdicao(() => {
    if (history.length < 3) return
    sentinela = null
    sairSemNovoAviso(() => history.go(-2))
  })
}

function desligarGuarda() {
  window.removeEventListener('beforeunload', protegerSaida)
  window.removeEventListener('popstate', aoVoltar)
  atualizarGuardaDeLinks()
}

export function pedirSaidaDaEdicao(continuar: () => void) {
  const ativos = editoresAtivos()
  if (ativos.some(editor => editor.pendente)) return
  if (ativos.length) ativos[0].pedir(continuar)
  else continuar()
}

export function sairSemNovoAviso(continuar: () => void) {
  saidaAutorizada = true
  try { continuar() }
  finally { window.setTimeout(() => { saidaAutorizada = false }, 1000) }
}

function protegerSaida(evento: BeforeUnloadEvent) {
  if (!editores.size || saidaAutorizada) return
  evento.preventDefault()
  evento.returnValue = ''
}

function guardarLink(evento: MouseEvent) {
  if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return
  const link = evento.target instanceof Element ? evento.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
  const url = new URL(link.href, location.href)
  if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return
  if (!retirando && !editoresAtivos().length) return
  evento.preventDefault()
  pedirSaidaDaEdicao(() => retirarVoltar(() => sairSemNovoAviso(() => location.assign(url.href))))
}

/** Participa da saída pelo CRM com o diálogo e o histórico do próprio editor. */
export function useGuardaNavegacaoEdicao(ativa: () => boolean, pendente: boolean, pedir: Pedido) {
  const atual = useRef({ ativa, pendente, pedir })
  useLayoutEffect(() => { atual.current = { ativa, pendente, pedir } }, [ativa, pendente, pedir])
  useLayoutEffect(() => {
    const id = Symbol('guarda de navegação')
    guardasDeNavegacao.set(id, {
      ativa: () => atual.current.ativa(),
      get pendente() { return atual.current.pendente },
      pedir: continuar => atual.current.pedir(continuar),
    })
    atualizarGuardaDeLinks()
    return () => {
      guardasDeNavegacao.delete(id)
      atualizarGuardaDeLinks()
    }
  }, [])
}

export function useDescarteEdicao(alterado: boolean, pendente: boolean) {
  const [continuar, setContinuar] = useState<(() => void) | null>(null)
  const tema = useTemaCrm()
  const protegido = alterado || pendente
  const estadoAtual = useRef({ pendente })
  const chave = useRef(Symbol('editor'))
  const foco = useRef<HTMLElement | null>(null)
  const botaoContinuar = useRef<HTMLButtonElement>(null)

  function pedir(acao: () => void) {
    if (pendente || continuar) return
    if (!alterado) { acao(); return }
    foco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setContinuar(() => acao)
  }

  useLayoutEffect(() => { estadoAtual.current = { pendente } }, [pendente])
  useLayoutEffect(() => {
    if (!protegido) return
    const id = chave.current
    editores.set(id, { get pendente() { return estadoAtual.current.pendente }, pedir: acao => {
      foco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setContinuar(atual => atual ?? acao)
    } })
    window.addEventListener('beforeunload', protegerSaida)
    window.addEventListener('popstate', aoVoltar)
    atualizarGuardaDeLinks()
    armarVoltar()
    return () => {
      editores.delete(id)
      if (editores.size) return
      retirarVoltar(() => {
        if (editores.size) armarVoltar()
        else desligarGuarda()
      })
    }
  }, [protegido])

  const confirmacao = <Dialog open={continuar !== null} onOpenChange={aberto => { if (!aberto) setContinuar(null) }}>
    <DialogContent theme={tema} showCloseButton={false}
      onOpenAutoFocus={e => { e.preventDefault(); botaoContinuar.current?.focus() }}
      onCloseAutoFocus={e => { e.preventDefault(); if (foco.current?.isConnected) foco.current.focus() }}>
      <DialogHeader>
        <DialogTitle>Descartar alterações?</DialogTitle>
        <DialogDescription>As alterações locais serão perdidas.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button ref={botaoContinuar} type="button" onClick={() => setContinuar(null)}>Continuar editando</Button>
        <Button type="button" variant="outline" onClick={() => { setContinuar(null); continuar?.() }}>Descartar alterações</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  return { pedir, confirmacao }
}
