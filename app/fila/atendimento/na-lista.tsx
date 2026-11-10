'use client'

import { useId, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ContextoAtendimentoLista } from '@/src/components/crm/contexto-atendimento'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Alert } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Dialog } from '@/src/components/ui/dialog'
import { PainelAtendimento, type LeituraPainelAtendimento } from './painel'

const falhaLeitura = { ok: false as const, erro: 'Não foi possível carregar o atendimento. Tente novamente.' }
type PontoDaLista = { idAcao: string; x: number; y: number }

export function AtendimentoNaLista({ carregarAcao, children }: {
  carregarAcao: (empresaId: string) => Promise<LeituraPainelAtendimento>
  children: ReactNode
}) {
  const router = useRouter()
  const prefixoAcao = useId() + '-atendimento-'
  const lista = useRef<HTMLDivElement>(null)
  const comando = useRef<PontoDaLista | null>(null)
  const retorno = useRef<{ ponto: PontoDaLista; fechando: boolean; liberado: boolean } | null>(null)
  const pedido = useRef(0)
  const [ocupado, setOcupado] = useState(false)
  const [atendimento, setAtendimento] = useState<{ empresaId: string; leitura?: LeituraPainelAtendimento } | null>(null)
  const [atualizacao, setAtualizacao] = useState<'carregando' | { erro: string } | null>(null)
  const [atualizandoLista, iniciarAtualizacao] = useTransition()
  const esperandoLista = useRef(false)

  function encontrarGatilho(idAcao: string) {
    const botao = document.getElementById(idAcao)
    return botao instanceof HTMLButtonElement && lista.current?.contains(botao) ? botao : null
  }

  function atualizar() {
    if (lista.current?.isConnected) iniciarAtualizacao(() => router.refresh())
  }

  function travarComando(idAcao: string) {
    if (comando.current || atendimento || retorno.current || atualizandoLista) return null
    const gatilho = encontrarGatilho(idAcao)
    if (!gatilho) return null
    const atual = { idAcao, x: window.scrollX, y: window.scrollY }
    comando.current = atual
    setOcupado(true)
    return {
      estaAtivo: () => comando.current === atual && gatilho.isConnected && lista.current?.contains(gatilho) === true
        && !gatilho.closest('[hidden], [inert], [aria-hidden="true"]'),
      liberar: () => {
        comando.current = null
        if (lista.current?.isConnected) setOcupado(false)
      },
    }
  }

  async function carregar(empresaId: string, atualizarEditor = false) {
    const atual = ++pedido.current
    if (atualizarEditor) setAtualizacao('carregando')
    else setAtendimento({ empresaId })
    let leitura: LeituraPainelAtendimento
    try { leitura = await carregarAcao(empresaId) }
    catch { leitura = falhaLeitura }
    if (atual !== pedido.current || !lista.current?.isConnected) return
    if (!atualizarEditor || leitura.ok) setAtendimento({ empresaId, leitura })
    if (atualizarEditor) setAtualizacao(leitura.ok ? null : { erro: leitura.erro })
  }

  function abrir(empresaId: string, idAcao: string) {
    const ponto = comando.current
    if (ponto?.idAcao !== idAcao || !encontrarGatilho(idAcao)) return
    retorno.current = { ponto, fechando: false, liberado: false }
    void carregar(empresaId)
  }

  function fechar() {
    pedido.current++
    if (retorno.current) retorno.current.fechando = true
    setAtendimento(null)
    setAtualizacao(null)
    atualizar()
  }

  function restaurarOrigem() {
    const volta = retorno.current
    if (!volta?.liberado || esperandoLista.current || !lista.current?.isConnected) return
    retorno.current = null
    const { idAcao, x, y } = volta.ponto
    const gatilho = encontrarGatilho(idAcao)
    const alvo = gatilho && !gatilho.disabled ? gatilho : lista.current
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y)
    alvo.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    esperandoLista.current = atualizandoLista
    restaurarOrigem()
  })

  function liberarFoco() {
    // Trocar o aviso de leitura pelo formulário também desmonta o conteúdo antigo.
    if (!retorno.current?.fechando) return
    retorno.current.liberado = true
    restaurarOrigem()
  }

  const bloqueado = ocupado || atendimento !== null || atualizandoLista
  const erroLeitura = atendimento?.leitura?.ok === false ? atendimento.leitura.erro : null
  return <ContextoAtendimentoLista.Provider value={{ prefixoAcao, abrir, atualizar, bloqueado, consultaBloqueada: bloqueado, travarComando }}>
    <div ref={lista} tabIndex={-1}>{children}</div>
    <Dialog open={atendimento !== null}>
      {atendimento?.leitura?.ok ? <PainelAtendimento {...atendimento.leitura.dados} aoVoltar={fechar}
        aoAtualizar={() => void carregar(atendimento.empresaId, true)} aoRestaurarFoco={liberarFoco}
        avisoAtualizacao={atualizacao === 'carregando' ? <p role="status">Atualizando atendimento…</p> : atualizacao && <div className="grid gap-3">
          <Alert variant="danger" role="alert">{atualizacao.erro}</Alert>
          <Button type="button" variant="outline" onClick={() => void carregar(atendimento.empresaId, true)}>Tentar novamente</Button>
        </div>} /> : atendimento && <PainelSobrepostoCrm titulo="Atendimento" descricao="Atendimento da empresa selecionada."
        aoFechar={fechar} ocupado={!atendimento.leitura} onCloseAutoFocus={evento => { evento.preventDefault(); liberarFoco() }}>
        {erroLeitura !== null ? <div className="grid gap-3">
          <Alert variant="danger" role="alert">{erroLeitura}</Alert>
          <Button type="button" variant="outline" onClick={() => void carregar(atendimento.empresaId)}>Tentar novamente</Button>
        </div> : <p role="status">Carregando atendimento…</p>}
      </PainelSobrepostoCrm>}
    </Dialog>
  </ContextoAtendimentoLista.Provider>
}
