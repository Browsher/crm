'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogTrigger } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { ContextoResultadoBusca } from './contexto-resultado-busca'
import { ConteudoConsultaEmpresa } from './empresa-dialogo'
import type { GrupoEmpresa } from './empresa-detalhes'
import { PainelSobrepostoCrm } from './painel-lateral'
import styles from './busca-dialogo.module.css'

type Resultado = { ok: true; conteudo: ReactNode } | { ok: false; erro: string }
type Props = { nome: string; carregarAcao: () => Promise<Resultado>; abrirInicialmente?: boolean; conteudoInicial?: ReactNode; rotulo?: string }
export function BuscaPainel({ nome, carregarAcao, abrirInicialmente = false, conteudoInicial, rotulo = 'Ver empresas' }: Props) {
  const [aberto, setAberto] = useState(abrirInicialmente)
  const [conteudo, setConteudo] = useState<ReactNode>(conteudoInicial ?? null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [empresa, setEmpresa] = useState<ReferenciaEmpresa | null>(null)
  const [grupo, setGrupo] = useState<GrupoEmpresa | null>(null)
  const [rodape, setRodape] = useState<HTMLDivElement | null>(null)
  const pedido = useRef(0)
  const resultado = useRef<HTMLDivElement>(null)
  const retorno = useRef<{ gatilho: HTMLButtonElement; rolagem: number } | null>(null)

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
    const corpo = resultado.current?.closest<HTMLElement>('[data-painel-corpo]')
    retorno.current = { gatilho, rolagem: corpo?.scrollTop ?? 0 }
    setEmpresa(referencia)
  }

  async function carregar() {
    const atual = ++pedido.current
    setConteudo(null); setErro(''); setCarregando(true)
    try {
      const r = await carregarAcao()
      if (atual !== pedido.current) return
      if (r.ok) setConteudo(r.conteudo)
      else setErro(r.erro)
    } catch {
      if (atual === pedido.current) setErro('Não foi possível carregar a busca. Tente novamente.')
    } finally {
      if (atual === pedido.current) setCarregando(false)
    }
  }
  function mudar(proximo: boolean) {
    setAberto(proximo)
    if (proximo) void carregar()
    else {
      pedido.current++
      setConteudo(null)
      setEmpresa(null)
      setGrupo(null)
      retorno.current = null
    }
  }

  function voltarOuFechar() {
    if (grupo) setGrupo(null)
    else if (empresa) setEmpresa(null)
    else mudar(false)
  }
  return <Dialog open={aberto} onOpenChange={mudar}>
    <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`${rotulo}: ${nome}`}>{rotulo}</Button></DialogTrigger>
    <PainelSobrepostoCrm titulo={empresa ? 'Ver empresa' : nome}
      descricao={empresa ? 'Dados salvos da empresa selecionada.' : 'Confira as empresas desta busca.'}
      aoFechar={voltarOuFechar} rotuloFechar={empresa ? 'Voltar' : 'Fechar'} ocupado={carregando}
      className={styles.painel} rodape={<div ref={setRodape} className={styles.acoes} hidden={Boolean(empresa)} />}>
      <div ref={resultado} hidden={Boolean(empresa)}>
        {carregando && <p role="status">Carregando busca…</p>}
        {erro && <div className="grid gap-3"><Alert variant="danger" role="alert">{erro}</Alert><Button type="button" variant="outline" onClick={() => void carregar()}>Tentar novamente</Button></div>}
        <ContextoResultadoBusca.Provider value={{ verEmpresa, rodape }}>{conteudo}</ContextoResultadoBusca.Provider>
      </div>
      {empresa && <ConteudoConsultaEmpresa referencia={empresa} grupo={grupo} aoAbrir={setGrupo} />}
    </PainelSobrepostoCrm>
  </Dialog>
}

export function FiltrosBuscaPainel({ nome, children }: { nome: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return <Dialog open={aberto} onOpenChange={setAberto}>
    <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`Filtros usados: ${nome}`}>Filtros usados</Button></DialogTrigger>
    <PainelSobrepostoCrm titulo="Filtros usados" descricao={nome} aoFechar={() => setAberto(false)}>{children}</PainelSobrepostoCrm>
  </Dialog>
}
