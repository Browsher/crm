'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useGuardaNavegacaoEdicao } from '@/src/components/crm/descarte-edicao'

type Saida = 'tarefa' | 'ficha' | 'navegador' | (() => void)
type Marca = { href: string; id: string }
const CHAVE = '__edicaoFichaCarteira'
const CHAVE_SESSAO = 'crm:carteira:entrada-edicao'

type EntradaNavegacao = { index: number; url: string | null; key: string }
type Navegacao = {
  currentEntry: EntradaNavegacao | null
  entries: () => EntradaNavegacao[]
}

function navegacaoDoNavegador() {
  return (window as Window & { navigation?: Navegacao }).navigation
}

function entradaAnterior() {
  const navegacao = navegacaoDoNavegador()
  const atual = navegacao?.currentEntry
  return atual ? navegacao?.entries()[atual.index - 1] : undefined
}

function entradaAnteriorEh(href: string) {
  return entradaAnterior()?.url === new URL(href, location.href).href
}

export function voltarParaListaAnterior(href: string) {
  if (!entradaAnteriorEh(href)) return false
  const destino = new URL(href, location.href).href
  // Após reload da ficha, a entrada anterior pode apontar para a árvore
  // interceptada do documento antigo. Recarregue só se o popstate chegar
  // no documento atual e no destino que acabamos de validar.
  window.addEventListener('popstate', () => {
    if (location.href === destino) location.reload()
  }, { once: true })
  history.back()
  return true
}

function lerMarca(estado: unknown): Marca | null {
  if (!estado || typeof estado !== 'object' || !(CHAVE in estado)) return null
  const marca = estado[CHAVE] as Partial<Marca> | null
  return marca?.href === location.href && typeof marca.id === 'string' ? { href: marca.href, id: marca.id } : null
}

function marcaAtual(): Marca | null {
  const entrada = navegacaoDoNavegador()?.currentEntry
  const marca = lerMarca(history.state)
  if (!entrada) return marca
  if (!entradaAnteriorEh(location.href)) return null
  if (marca) return marca
  // O App Router substitui history.state no reload. A chave da entrada
  // permanece e permite identificar a duplicata sem adivinhar pelo endereço.
  try {
    const recuperada = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? 'null')
    return recuperada?.entrada === entrada.key && typeof recuperada.id === 'string' ? { href: location.href, id: recuperada.id } : null
  } catch { return null }
}

// Um único editor ocupa a ficha. A entrada sentinela repete somente a URL
// atual, com a árvore do App Router, e é retirada antes de sair da ficha.
export function useGuardaFicha(alterada: boolean, pendente: boolean, bloqueada: () => boolean, aoSair: (saida: Saida) => void) {
  const [pedido, setPedido] = useState<Saida | null>(null)
  const [restaurando, setRestaurando] = useState(() => typeof window !== 'undefined' && !!navegacaoDoNavegador()?.currentEntry && !!marcaAtual())
  const foco = useRef<HTMLElement | null>(null)
  const atual = useRef({ alterada, pendente, bloqueada, aoSair })
  const sentinela = useRef<Marca | null>(null)
  const retirada = useRef<{ continuar?: () => void } | null>(null)
  const frame = useRef<number | null>(null)
  const saidaConfirmada = useRef(false)
  const iniciou = useRef(false)
  const entradaRestaurada = useRef<EntradaNavegacao | null>(null)

  function armar() {
    const restaurada = marcaAtual()
    if (restaurada) {
      sentinela.current = restaurada
      return
    }
    const marca = sentinela.current ?? { href: location.href, id: crypto.randomUUID() }
    sentinela.current = marca
    history.pushState({ ...history.state, [CHAVE]: marca }, '', marca.href)
    const entrada = navegacaoDoNavegador()?.currentEntry
    if (entrada) {
      try { sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify({ entrada: entrada.key, id: marca.id })) }
      catch { /* A marca do histórico protege a edição nesta página. */ }
    }
  }

  function retirar(continuar?: () => void) {
    if (retirada.current) {
      if (continuar) retirada.current.continuar = continuar
      return
    }
    const marca = marcaAtual()
    sentinela.current = null
    if (!marca) {
      continuar?.()
      return
    }
    retirada.current = { continuar }
    history.back()
  }

  function concluir(saida: Saida) {
    retirar(() => {
      saidaConfirmada.current = true
      setPedido(null)
      atual.current.aoSair(saida)
    })
  }

  function pedir(saida: Saida) {
    if (atual.current.bloqueada()) return
    if (!atual.current.alterada) {
      concluir(saida)
      return
    }
    const alvo = document.activeElement
    foco.current = alvo instanceof HTMLElement ? alvo : null
    setPedido(anterior => anterior ?? saida)
  }

  useLayoutEffect(() => {
    atual.current = { alterada, pendente, bloqueada, aoSair }
    if (!iniciou.current) {
      iniciou.current = true
      // Após reload o rascunho/comando continua na sessão, mas a tarefa não
      // está aberta. Retire a entrada antiga antes da próxima interação.
      if (!alterada && !pendente && marcaAtual()) {
        entradaRestaurada.current = entradaAnterior() ?? null
        retirar()
        return
      }
    }
    if (saidaConfirmada.current) {
      if (!alterada && !pendente) saidaConfirmada.current = false
      return
    }
    if (retirada.current) return
    if ((alterada || pendente) && !sentinela.current) armar()
    if (!alterada && !pendente && sentinela.current) retirar()
  })

  useLayoutEffect(() => {
    const proteger = (evento: BeforeUnloadEvent) => {
      if (!saidaConfirmada.current && (atual.current.alterada || atual.current.bloqueada())) evento.preventDefault()
    }
    const voltar = (evento: PopStateEvent) => {
      if (retirada.current) {
        const entrada = entradaRestaurada.current
        if (entrada?.key === navegacaoDoNavegador()?.currentEntry?.key && entrada?.url === location.href) {
          // A entrada canônica pode ter uma árvore interceptada de antes do
          // reload. Conclua a restauração antes de permitir editar de novo.
          location.reload()
          return
        }
        if (entrada) {
          entradaRestaurada.current = null
          setRestaurando(false)
        }
        if (frame.current !== null) return
        // Deixe o App Router restaurar a entrada antes de navegar novamente.
        frame.current = requestAnimationFrame(() => {
          frame.current = null
          const continuar = retirada.current?.continuar
          retirada.current = null
          if (continuar) continuar()
          else if (atual.current.alterada || atual.current.pendente) armar()
        })
        return
      }
      const marca = sentinela.current
      if (!marca || lerMarca(evento.state)?.id === marca.id) return
      if (location.href !== marca.href) {
        sentinela.current = null
        return
      }
      armar()
      pedir('navegador')
    }
    window.addEventListener('beforeunload', proteger)
    window.addEventListener('popstate', voltar)
    return () => {
      window.removeEventListener('beforeunload', proteger)
      window.removeEventListener('popstate', voltar)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
    // As leituras atuais são feitas pela ref dentro dos listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useGuardaNavegacaoEdicao(
    () => alterada || pendente || retirada.current !== null,
    pendente,
    continuar => pedir(continuar),
  )

  return {
    pedido, foco, pedir, concluir, restaurando,
    cancelar: () => setPedido(null),
    confirmar: () => { if (pedido && !bloqueada()) concluir(pedido) },
  }
}
