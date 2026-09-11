'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FormularioContato } from '@/src/features/contato/formulario'
import type { Contato } from '@/src/features/contato/historico'
import { rascunhoAlterado, rascunhoInicial, type RascunhoContato } from '@/src/features/contato/rascunho'
import { ROTULO, ehTipo } from '@/src/features/contato/tipos'
import type { EmpresaComigo } from '@/src/features/fila/consulta'
import { useTemaCrm } from '@/src/components/crm/tema'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import styles from './ficha.module.css'

function endereco(e: EmpresaComigo) {
  if (e.endereco) return [e.endereco.logradouro, e.endereco.bairro, `${e.endereco.localidade}/${e.endereco.uf}`].filter(Boolean).join(', ')
  if (e.cep) return `CEP ${e.cep}. Endereço não encontrado na base de CEP.`
  return 'Localização não cadastrada'
}
function dataCivil(valor: string) {
  const [ano, mes, dia] = valor.split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor
}
function Historico({ contatos, erro }: { contatos: Contato[]; erro: boolean }) {
  if (erro) return <Alert variant="danger"><AlertTitle>Não foi possível carregar o histórico</AlertTitle><AlertDescription>Tente atualizar a página.</AlertDescription></Alert>
  if (!contatos.length) return <p className={styles.vazio}>Ainda não há uma conversa registrada.</p>
  return <ol className={styles.historico}>{contatos.map(c => <li key={c.id}>
    <div className={styles.historicoCabecalho}><strong>{ehTipo(c.tipo) ? ROTULO[c.tipo] : c.tipo}</strong><time dateTime={c.criadoEm.toISOString()}>{new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short', timeZone:'America/Sao_Paulo' }).format(c.criadoEm)}</time></div>
    {c.nota ? <p>{c.nota}</p> : <p className={styles.ausente}>Sem anotação.</p>}
    {c.proximoPasso ? <p><strong>Próximo passo:</strong> {c.proximoPasso}{c.proximoPassoData ? ` em ${dataCivil(c.proximoPassoData)}` : ''}</p> : null}
    <p className={styles.autor}>Registrado por {c.autor ?? 'sistema'}</p>
  </li>)}</ol>
}

export function Ficha({ empresa, contatos, erroHistorico = false, voltarPara = '/carteira' }: { empresa: EmpresaComigo; contatos: Contato[]; erroHistorico?: boolean; voltarPara?: string }) {
  const router = useRouter()
  const tema = useTemaCrm()
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<RascunhoContato>(() => rascunhoInicial(empresa.posse))
  const [pendente, setPendente] = useState(false)
  const pendenteRef = useRef(false)
  const [descarte, setDescarte] = useState<'fechar' | 'voltar' | { href: string } | null>(null)
  const editor = useRef<HTMLDivElement>(null)
  const sentinela = useRef<string | null>(null)
  const removendoSentinela = useRef(false)
  const depoisDeRemover = useRef<(() => void) | null>(null)
  const alterado = editando && rascunhoAlterado(rascunho)

  function mudarPendente(valor: boolean) {
    pendenteRef.current = valor
    // A action roda numa transição. A guarda da página precisa bloquear antes
    // de aguardar a resposta, inclusive os controles fora do formulário.
    flushSync(() => setPendente(valor))
  }

  function removerSentinela(depois?: () => void) {
    if (!sentinela.current) { depois?.(); return }
    sentinela.current = null
    removendoSentinela.current = true
    depoisDeRemover.current = depois ?? null
    history.back()
  }

  useEffect(() => { if (editando) editor.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus() }, [editando])
  useEffect(() => {
    if (!alterado) return
    const proteger = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', proteger)
    return () => window.removeEventListener('beforeunload', proteger)
  }, [alterado])
  useEffect(() => {
    if ((!alterado && !pendente) || sentinela.current || removendoSentinela.current) return
    const id = `carteira:${empresa.id}:${Date.now()}`
    sentinela.current = id
    history.pushState({ ...history.state, __rascunhoCarteira: id }, '', window.location.href)
  }, [alterado, empresa.id, pendente])
  useEffect(() => {
    if (!alterado && !pendente && sentinela.current) removerSentinela()
  }, [alterado, pendente])
  useEffect(() => {
    const guardar = (evento: MouseEvent) => {
      const link = (evento.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
      if (!link || !editando) return
      if (pendenteRef.current) { evento.preventDefault(); return }
      if (!alterado) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      evento.preventDefault()
      setDescarte({ href: `${url.pathname}${url.search}${url.hash}` })
    }
    document.addEventListener('click', guardar, true)
    return () => document.removeEventListener('click', guardar, true)
  }, [alterado, editando, pendente])
  useEffect(() => {
    const guardarVoltar = (evento: PopStateEvent) => {
      if (removendoSentinela.current) {
        removendoSentinela.current = false
        const continuar = depoisDeRemover.current
        depoisDeRemover.current = null
        continuar?.()
        return
      }
      const id = sentinela.current
      if (!id || (evento.state as { __rascunhoCarteira?: string } | null)?.__rascunhoCarteira === id) return
      history.pushState({ ...history.state, __rascunhoCarteira: id }, '', window.location.href)
      if (!pendenteRef.current) setDescarte('voltar')
    }
    window.addEventListener('popstate', guardarVoltar)
    return () => window.removeEventListener('popstate', guardarVoltar)
  }, [pendente])

  function pedirFechar() {
    if (pendenteRef.current) return
    if (alterado) { setDescarte('fechar'); return }
    removerSentinela(() => setEditando(false))
  }
  function confirmar() {
    const voltar = descarte === 'voltar'
    const href = descarte && descarte !== 'fechar' && descarte !== 'voltar' ? descarte.href : null
    setRascunho(rascunhoInicial(empresa.posse)); setDescarte(null)
    if (voltar) {
      sentinela.current = null
      setEditando(false)
      history.go(-2)
      return
    }
    removerSentinela(() => {
      setEditando(false)
      if (href) router.push(href)
    })
  }

  return <article className={styles.ficha}>
    <header className={styles.cabecalho}><div><p className={styles.vinculo}>Na sua carteira</p><h1>{empresa.razaoSocial}</h1><p>{empresa.nomeFantasia ?? 'Nome fantasia não cadastrado'}</p><p>{endereco(empresa)}</p></div><Button onClick={() => setEditando(true)} disabled={editando || pendente}>Registrar atendimento</Button></header>
    <div className={styles.colunas}><div className={styles.esquerda}>
      <Card><CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader><CardContent><dl className={styles.dados}>
        <dt>Contato</dt><dd>{empresa.contatoNome ?? 'Contato não cadastrado'}</dd><dt>Telefone</dt><dd>{empresa.telefone || 'Telefone não cadastrado'}</dd><dt>E-mail</dt><dd>{empresa.email ?? 'E-mail não cadastrado'}</dd><dt>Localização</dt><dd>{endereco(empresa)}</dd><dt>CNPJ</dt><dd>{empresa.cnpj}</dd><dt>CNAE</dt><dd>{empresa.cnaePrincipal ?? 'CNAE não cadastrado'}</dd>
      </dl></CardContent></Card>
      <Card><CardHeader><CardTitle>Próximo passo</CardTitle></CardHeader><CardContent>{empresa.proximoPasso ? <div className={empresa.vencido ? styles.atrasado : undefined}><p>{empresa.proximoPasso}</p>{empresa.proximoPassoData ? <p>{dataCivil(empresa.proximoPassoData)}{empresa.vencido ? ' · Atrasado' : ''}</p> : null}</div> : <p className={styles.ausente}>Sem próximo passo combinado.</p>}</CardContent></Card>
    </div><Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent><Historico contatos={contatos} erro={erroHistorico} /></CardContent></Card></div>
    {editando ? <section ref={editor} className={styles.editor} aria-label="Registrar atendimento"><div className={styles.editorCabecalho}><h2>Registrar atendimento</h2><Button type="button" variant="ghost" onClick={pedirFechar} disabled={pendente}>Cancelar atendimento</Button></div><FormularioContato empresaId={empresa.id} posse={empresa.posse} comDevolver voltarPara={voltarPara} visual="fila" rascunho={rascunho} onDraftChange={setRascunho} bloqueado={pendente} somenteLeitura={pendente} onPendingChange={mudarPendente} onSaved={() => { setRascunho(rascunhoInicial(empresa.posse)); removerSentinela(() => { setEditando(false); router.refresh() }) }} /></section> : null}
    <Dialog open={descarte !== null} onOpenChange={aberto => { if (!aberto && !pendente) setDescarte(null) }}><DialogContent theme={tema}><DialogHeader><DialogTitle>Descartar as alterações?</DialogTitle><DialogDescription>As anotações deste atendimento ainda não foram registradas.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={confirmar}>Descartar e continuar</Button></DialogFooter></DialogContent></Dialog>
  </article>
}
