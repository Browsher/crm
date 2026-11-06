'use client'

import { useLayoutEffect, type RefObject } from 'react'

const seletorFocaveis = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'

function focaveis(raiz: HTMLElement) {
  return Array.from(raiz.querySelectorAll<HTMLElement>(seletorFocaveis)).filter(elemento => {
    if (elemento.tabIndex < 0 || elemento.matches(':disabled') || elemento.closest('[inert], [hidden]')) return false
    for (let atual: HTMLElement | null = elemento; atual; atual = atual.parentElement) {
      const estilo = getComputedStyle(atual)
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return false
      if (atual === raiz) break
    }
    return true
  })
}

export function usePainelMovel(raiz: RefObject<HTMLElement | null>, ativo: boolean): void {
  useLayoutEffect(() => {
    const painel = raiz.current
    if (!ativo || !painel || !window.matchMedia) return
    const media = window.matchMedia('(max-width: 820px)')
    let liberar: (() => void) | undefined

    function atualizar() {
      if (!media.matches) {
        liberar?.()
        liberar = undefined
        return
      }
      if (liberar || !painel) return
      let ativoMovel = true

      const atributos = ['role', 'aria-modal'].map(nome => [nome, painel.getAttribute(nome)] as const)
      painel.setAttribute('role', 'dialog')
      painel.setAttribute('aria-modal', 'true')
      const inertesAlterados = new Set<Element>()
      const estilos = [document.body, document.documentElement].map(elemento => ({
        elemento,
        valor: elemento.style.getPropertyValue('overflow'),
        prioridade: elemento.style.getPropertyPriority('overflow'),
      }))
      for (const { elemento } of estilos) elemento.style.setProperty('overflow', 'hidden')

      // O Dialog central usa um portal próprio e deve continuar dono de seu foco.
      const dialogosCentrais = () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"][data-state="open"], [role="dialog"][aria-modal="true"], [role="alertdialog"]'))
        .filter(dialogo => dialogo !== painel && dialogo.dataset.state !== 'closed' && !dialogo.hidden)

      function isolarFundo() {
        const dialogos = dialogosCentrais()
        const cobertos = new Set<Element>()
        for (let ramo: Element | null = painel; ramo?.parentElement; ramo = ramo.parentElement) {
          for (const irmao of ramo.parentElement.children) {
            // O portal nasce antes do Content: não o tornar inerte nesse intervalo,
            // pois isso impediria o foco inicial síncrono controlado pelo Dialog.
            const portalCentral = irmao.matches('.ui-dialog-portal') || irmao.querySelector('.ui-dialog-portal')
            if (irmao !== ramo && !portalCentral && !dialogos.some(dialogo => irmao === dialogo || irmao.contains(dialogo))) cobertos.add(irmao)
          }
          if (ramo.parentElement === document.body) break
        }
        for (const elemento of inertesAlterados) {
          if (cobertos.has(elemento)) continue
          if (elemento.getAttribute('inert') === '') elemento.removeAttribute('inert')
          inertesAlterados.delete(elemento)
        }
        for (const elemento of cobertos) {
          if (elemento.hasAttribute('inert')) continue
          elemento.setAttribute('inert', '')
          inertesAlterados.add(elemento)
        }
      }

      const focarTitulo = () => painel.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      const guardarFoco = (evento: FocusEvent) => {
        if (dialogosCentrais().length || painel.contains(evento.target as Node)) return
        focarTitulo()
      }
      const guardarTab = (evento: KeyboardEvent) => {
        if (evento.key !== 'Tab' || evento.defaultPrevented || dialogosCentrais().length) return
        const alvos = focaveis(painel)
        const indice = alvos.indexOf(document.activeElement as HTMLElement)
        if (!alvos.length) {
          evento.preventDefault()
          focarTitulo()
        } else if (indice === -1 || (evento.shiftKey ? indice === 0 : indice === alvos.length - 1)) {
          evento.preventDefault()
          alvos[evento.shiftKey ? alvos.length - 1 : 0].focus()
        }
      }

      isolarFundo()
      const observador = new MutationObserver(() => {
        if (!ativoMovel || !painel.isConnected) return
        isolarFundo()
        // Remover o controle focado pode levar a BODY sem emitir focusin.
        if (!dialogosCentrais().length && !painel.contains(document.activeElement)) focarTitulo()
      })
      observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'aria-modal', 'data-state'] })
      document.addEventListener('focusin', guardarFoco)
      document.addEventListener('keydown', guardarTab)
      if (!dialogosCentrais().length && !painel.contains(document.activeElement)) focarTitulo()

      liberar = () => {
        ativoMovel = false
        observador.disconnect()
        document.removeEventListener('focusin', guardarFoco)
        document.removeEventListener('keydown', guardarTab)
        for (const elemento of inertesAlterados) {
          if (elemento.getAttribute('inert') === '') elemento.removeAttribute('inert')
        }
        for (const { elemento, valor, prioridade } of estilos) {
          if (elemento.style.getPropertyValue('overflow') !== 'hidden' || elemento.style.getPropertyPriority('overflow')) continue
          if (valor) elemento.style.setProperty('overflow', valor, prioridade)
          else elemento.style.removeProperty('overflow')
        }
        for (const [nome, valor] of atributos) {
          if (painel.getAttribute(nome) !== (nome === 'role' ? 'dialog' : 'true')) continue
          if (valor === null) painel.removeAttribute(nome)
          else painel.setAttribute(nome, valor)
        }
      }
    }

    atualizar()
    media.addEventListener('change', atualizar)
    return () => {
      media.removeEventListener('change', atualizar)
      liberar?.()
    }
  }, [raiz, ativo])
}
