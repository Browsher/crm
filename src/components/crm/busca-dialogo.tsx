'use client'

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { PainelAtendimento, type DadosPainelAtendimento } from '@/app/fila/atendimento/painel'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { ContextoResultadoBusca } from './contexto-resultado-busca'
import { ConteudoConsultaEmpresa } from './empresa-dialogo'
import type { GrupoEmpresa } from './empresa-detalhes'
import { PainelSobrepostoCrm } from './painel-lateral'
import styles from './busca-dialogo.module.css'

type Resultado = { ok: true; conteudo: ReactNode } | { ok: false; erro: string }
type LeituraAtendimento = { ok: true; dados: DadosPainelAtendimento } | { ok: false; erro: string }
type Props = { nome: string; carregarAcao: () => Promise<Resultado>; abrirInicialmente?: boolean; conteudoInicial?: ReactNode; rotulo?: string;
  carregarAtendimentoAcao?: (empresaId: string) => Promise<LeituraAtendimento> }
export function BuscaPainel({ nome, carregarAcao, carregarAtendimentoAcao, abrirInicialmente = false, conteudoInicial, rotulo = 'Ver empresas' }: Props) {
  const [aberto, setAberto] = useState(abrirInicialmente)
  const [conteudo, setConteudo] = useState<ReactNode>(conteudoInicial ?? null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [revisao, setRevisao] = useState(0)
  const [empresa, setEmpresa] = useState<ReferenciaEmpresa | null>(null)
  const [grupo, setGrupo] = useState<GrupoEmpresa | null>(null)
  const [rodape, setRodape] = useState<HTMLDivElement | null>(null)
  const [inclusaoPendente, setInclusaoPendente] = useState(false)
  const [comandoPendente, setComandoPendente] = useState(false)
  const [atendimento, setAtendimento] = useState<{ empresaId: string; leitura?: LeituraAtendimento } | null>(null)
  const [atualizacaoAtendimento, setAtualizacaoAtendimento] = useState<{ erro: string } | 'carregando' | null>(null)
  const prefixoAcao = useId() + '-atendimento-'
  const abertoAtual = useRef(abrirInicialmente)
  const comando = useRef<{ rolagem: number } | null>(null)
  const pedido = useRef(0)
  const pedidoAtendimento = useRef(0)
  const resultado = useRef<HTMLDivElement>(null)
  const retorno = useRef<{ gatilho: HTMLButtonElement; rolagem: number } | null>(null)
  const retornoAtendimento = useRef<{ idAcao: string; rolagem: number; voltando: boolean } | null>(null)
  const carregandoAtendimento = Boolean(atendimento && !atendimento.leitura)
  const dadosAtendimento = atendimento?.leitura?.ok ? atendimento.leitura.dados : null

  function restaurarResultado() {
    const volta = retornoAtendimento.current
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (!volta?.voltando || !corpo || atendimento || empresa) return false
    corpo.scrollTop = volta.rolagem
    if (carregando) return false
    const gatilho = document.getElementById(volta.idAcao)
    const alvo = gatilho instanceof HTMLButtonElement && corpo.contains(gatilho) && !gatilho.disabled
      ? gatilho : corpo.closest('[data-painel-lateral]')?.querySelector<HTMLElement>('header h2')
    alvo?.focus({ preventScroll: true })
    if (!erro) retornoAtendimento.current = null
    return Boolean(alvo)
  }

  useLayoutEffect(() => { restaurarResultado() })

  const empresaAtendimento = atendimento?.empresaId
  useLayoutEffect(() => {
    if (!empresaAtendimento) return
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (!corpo) return
    corpo.scrollTop = 0
    corpo.closest('[data-painel-lateral]')?.querySelector<HTMLElement>('header h2')?.focus({ preventScroll: true })
  }, [empresaAtendimento])

  useLayoutEffect(() => {
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (!corpo || !retorno.current) return
    if (empresa) {
      corpo.scrollTop = 0
      corpo.closest('[data-painel-lateral]')?.querySelector<HTMLElement>('header h2')?.focus({ preventScroll: true })
    } else {
      const { gatilho, rolagem } = retorno.current
      corpo.scrollTop = rolagem
      gatilho.focus({ preventScroll: true })
      retorno.current = null
    }
  }, [empresa])

  function verEmpresa(referencia: ReferenciaEmpresa, gatilho: HTMLButtonElement) {
    if (comando.current || (carregarAtendimentoAcao && carregando) || retornoAtendimento.current?.voltando === false) return
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    retorno.current = { gatilho, rolagem: corpo?.scrollTop ?? 0 }
    setEmpresa(referencia)
  }

  async function carregar(preservar = false) {
    const atual = ++pedido.current
    if (!preservar) setConteudo(null)
    setErro(''); setCarregando(true)
    try {
      const r = await carregarAcao()
      if (atual !== pedido.current) return
      if (r.ok) { setConteudo(r.conteudo); setRevisao(atual) }
      else setErro(r.erro)
    } catch {
      if (atual === pedido.current) setErro('Não foi possível carregar a busca. Tente novamente.')
    } finally {
      if (atual === pedido.current) setCarregando(false)
    }
  }

  async function carregarAtendimento(empresaId: string, atualizar = false) {
    if (!carregarAtendimentoAcao) return
    const atual = ++pedidoAtendimento.current
    if (atualizar) setAtualizacaoAtendimento('carregando')
    else setAtendimento({ empresaId })
    let leitura: LeituraAtendimento
    try {
      leitura = await carregarAtendimentoAcao(empresaId)
    } catch {
      leitura = { ok: false, erro: 'Não foi possível carregar o atendimento. Tente novamente.' }
    }
    if (atual !== pedidoAtendimento.current) return
    if (!atualizar || leitura.ok) setAtendimento({ empresaId, leitura })
    if (atualizar) setAtualizacaoAtendimento(leitura.ok ? null : { erro: leitura.erro })
  }

  function travarComando() {
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (!corpo?.isConnected || comando.current || retorno.current || retornoAtendimento.current || inclusaoPendente || carregando || erro) return null
    const atual = { rolagem: corpo.scrollTop }
    comando.current = atual
    setComandoPendente(true)
    return {
      estaAtivo: () => comando.current === atual && abertoAtual.current && corpo.isConnected,
      liberar: () => { comando.current = null; setComandoPendente(false) },
    }
  }

  function abrirAtendimento(empresaId: string, idAcao: string) {
    if (!comando.current || !resultado.current?.isConnected || retorno.current || retornoAtendimento.current) return
    retornoAtendimento.current = { idAcao, rolagem: comando.current.rolagem, voltando: false }
    void carregarAtendimento(empresaId)
  }

  function voltarDoAtendimento() {
    pedidoAtendimento.current++
    if (retornoAtendimento.current) retornoAtendimento.current.voltando = true
    setAtendimento(null)
    setAtualizacaoAtendimento(null)
    void carregar(true)
  }

  function mudar(proximo: boolean) {
    if (!proximo && (inclusaoPendente || comando.current)) return
    abertoAtual.current = proximo
    setAberto(proximo)
    if (proximo) void carregar()
    else {
      pedido.current++
      pedidoAtendimento.current++
      setConteudo(null)
      setAtendimento(null)
      setAtualizacaoAtendimento(null)
      setEmpresa(null)
      setGrupo(null)
      retorno.current = null
      retornoAtendimento.current = null
    }
  }

  function voltarOuFechar() {
    if (grupo) setGrupo(null)
    else if (empresa) setEmpresa(null)
    else if (atendimento) voltarDoAtendimento()
    else mudar(false)
  }

  const foraDosResultados = Boolean(empresa || atendimento)
  const erroAtendimento = atendimento?.leitura?.ok === false ? atendimento.leitura.erro : null
  const atualizarResultados = () => void carregar(true)
  return <Dialog open={aberto} onOpenChange={mudar}>
    <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`${rotulo}: ${nome}`}>{rotulo}</Button></DialogTrigger>
    {dadosAtendimento && !inclusaoPendente ? <PainelAtendimento {...dadosAtendimento} aoVoltar={voltarDoAtendimento}
      aoAtualizar={() => void carregarAtendimento(dadosAtendimento.empresaId, true)}
      avisoAtualizacao={atualizacaoAtendimento === 'carregando' ? <p role="status">Atualizando atendimento…</p> : atualizacaoAtendimento && <div className="grid gap-3">
        <Alert variant="danger" role="alert">{atualizacaoAtendimento.erro}</Alert>
        <Button type="button" variant="outline" onClick={() => void carregarAtendimento(dadosAtendimento.empresaId, true)}>Tentar novamente</Button>
      </div>} /> : <PainelSobrepostoCrm
      titulo={empresa ? 'Ver empresa' : atendimento ? 'Atendimento' : nome}
      descricao={empresa ? 'Dados salvos da empresa selecionada.' : atendimento ? 'Atendimento da empresa selecionada.' : 'Confira as empresas desta busca.'}
      aoFechar={voltarOuFechar} rotuloFechar={foraDosResultados ? 'Voltar' : 'Fechar'} fecharBloqueado={inclusaoPendente || comandoPendente}
      ocupado={carregando || carregandoAtendimento || inclusaoPendente || comandoPendente}
      onOpenAutoFocus={evento => { if (restaurarResultado()) evento.preventDefault() }}
      onCloseAutoFocus={evento => { if (abertoAtual.current) evento.preventDefault() }}
      className={styles.painel} rodape={<div ref={setRodape} className={styles.acoes} hidden={foraDosResultados} />}>
      <div ref={resultado} hidden={foraDosResultados}>
        {carregando && <p role="status">{conteudo ? 'Atualizando empresas salvas…' : 'Carregando busca…'}</p>}
        {erro && <div className="grid gap-3"><Alert variant="danger" role="alert">{erro}</Alert><Button type="button" variant="outline" onClick={atualizarResultados}>Tentar novamente</Button></div>}
        <ContextoResultadoBusca.Provider key={revisao} value={{ verEmpresa, rodape, atendimento: carregarAtendimentoAcao ? {
          prefixoAcao, abrir: abrirAtendimento, atualizar: atualizarResultados,
          bloqueado: inclusaoPendente || comandoPendente || carregando || Boolean(erro),
          travarComando, consultaBloqueada: comandoPendente || carregando, registrarInclusao: setInclusaoPendente,
        } : undefined }}>{conteudo}</ContextoResultadoBusca.Provider>
      </div>
      {empresa && <ConteudoConsultaEmpresa referencia={empresa} grupo={grupo} aoAbrir={setGrupo} />}
      {atendimento && (erroAtendimento ? <div className="grid gap-3">
        <Alert variant="danger" role="alert">{erroAtendimento}</Alert>
        <Button type="button" variant="outline" onClick={() => void carregarAtendimento(atendimento.empresaId)}>Tentar novamente</Button>
      </div> : <p role="status">{inclusaoPendente ? 'Concluindo inclusão…' : 'Carregando atendimento…'}</p>)}
    </PainelSobrepostoCrm>}
  </Dialog>
}

export function FiltrosBuscaPainel({ nome, children }: { nome: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`Filtros usados: ${nome}`}>Filtros usados</Button></DialogTrigger>
    <PainelSobrepostoCrm titulo="Filtros usados" descricao={nome} aoFechar={() => setAberto(false)}>{children}</PainelSobrepostoCrm>
  </Dialog>
}
