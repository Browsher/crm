'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Mensagem } from '@/src/server/whatsapp/evolution'
import styles from './whatsapp.module.css'
import { historicoMensagensAcao, historicoFontesAcao } from './historico-acao'
import type { Cursores } from '@/src/server/whatsapp/consulta'
import { telefoneDoJid } from '@/src/lib/whatsapp-identificacao'
import { MidiaMensagem } from './midia-mensagem'

const horario = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' })
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const iniciais = (nome: string) => nome === 'Contato não identificado' ? '?' : nome.startsWith('+') ? '#' : nome.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()

function identificar(jid: string, itens: Mensagem[]) {
  const telefones = [...new Set(itens.map(m => m.telefone).filter((t): t is string => !!t && /^\+[1-9]\d{6,14}$/.test(t)))]
  const telefone = telefoneDoJid(jid) ?? (jid.endsWith('@lid') && telefones.length === 1 ? telefones[0] : null)
  const nome = itens.toSorted((a, b) => b.em.localeCompare(a.em))
    .find(m => m.direcao === 'recebida' && m.nome?.trim() && !/^\d+$/.test(m.nome.trim()))?.nome?.trim()
  return { nome: nome ?? telefone ?? 'Contato não identificado', telefone }
}

function mesclar(anteriores: Mensagem[], novas: Mensagem[]) {
  return [...new Map([...anteriores, ...novas].map(m => [JSON.stringify([m.fonteId, m.conversa, m.id]), m])).values()]
}

export function PainelWhatsApp({ mensagens, limiteHistorico, temMais = false, cursores, filtro = 'todos', fontesAtivas }: {
  mensagens: Mensagem[], limiteHistorico?: string, temMais?: boolean, cursores?: Cursores, filtro?: string, fontesAtivas?: string[]
}) {
  const escopo = JSON.stringify(fontesAtivas?.toSorted() ?? null)
  const [dados, guardar] = useState({ amostra: mensagens, acumuladas: mesclar([], mensagens), escopo })
  const [limite] = useState(limiteHistorico)
  const [pagina, mudarPagina] = useState(2)
  const [proximos, mudarProximos] = useState(cursores)
  const [avisos, mudarAvisos] = useState<string[]>([])
  const [mais, mudarMais] = useState(temMais)
  const [carregando, mudarCarregando] = useState(false)
  const [erro, mudarErro] = useState(false)
  if (dados.amostra !== mensagens || dados.escopo !== escopo) {
    const preservadas = fontesAtivas ? dados.acumuladas.filter(m => !!m.fonteId && fontesAtivas.includes(m.fonteId)) : dados.acumuladas
    guardar({ amostra: mensagens, acumuladas: mesclar(preservadas, mensagens), escopo })
    if (dados.escopo !== escopo && cursores) {
      const reconciliados = Object.fromEntries(Object.entries(cursores).map(([id, cursor]) => [id, proximos?.[id] ?? cursor]))
      mudarProximos(reconciliados)
      mudarMais(Object.values(reconciliados).some(c => c.temMais))
      mudarErro(false)
      mudarAvisos([])
    }
  }
  const geracao = useRef(0)
  useLayoutEffect(() => { geracao.current += 1 }, [escopo])
  const requisicao = useRef(false)
  const rolagem = useRef<HTMLOListElement>(null)
  const posicao = useRef({ id: '', topo: 0, noFim: true })
  const ancora = useRef<{ id: string; altura: number; topo: number } | null>(null)
  const [busca, mudarBusca] = useState('')
  async function carregar() {
    if (requisicao.current || !mais || !limite) return
    requisicao.current = true
    mudarCarregando(true)
    mudarErro(false)
    const geracaoInicial = geracao.current
    try {
      const resultado = proximos ? await historicoFontesAcao(filtro, proximos) : await historicoMensagensAcao(pagina, limite)
      if (geracao.current !== geracaoInicial) return
      if (!resultado.ok) { ancora.current = null; mudarErro(true); return }
      if (resultado.cursores) {
        mudarProximos(resultado.cursores)
        mudarAvisos(resultado.avisos ?? [])
        mudarErro((resultado.avisos?.length ?? 0) > 0)
      }
      const lista = rolagem.current
      ancora.current = lista ? { id: posicao.current.id, altura: lista.scrollHeight, topo: lista.scrollTop } : null
      guardar(atual => ({ ...atual, acumuladas: mesclar(resultado.mensagens, atual.acumuladas) }))
      mudarMais(resultado.temMais)
      mudarPagina(atual => atual + 1)
    } catch {
      if (geracao.current !== geracaoInicial) return
      ancora.current = null
      mudarErro(true)
    } finally {
      requisicao.current = false
      mudarCarregando(false)
    }
  }
  const router = useRouter()
  const [atualizando, iniciarAtualizacao] = useTransition()
  useEffect(() => {
    if (atualizando || carregando) return
    const atualizar = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      iniciarAtualizacao(() => router.refresh())
    }
    const intervalo = window.setInterval(atualizar, 15_000)
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('online', atualizar)
    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('online', atualizar)
    }
  }, [router, atualizando, carregando])

  const agrupadas = new Map<string, Mensagem[]>()
  for (const mensagem of dados.acumuladas) {
    const id = JSON.stringify([mensagem.fonteId, mensagem.conversa])
    const conversa = agrupadas.get(id) ?? []
    conversa.push(mensagem)
    agrupadas.set(id, conversa)
  }
  const conversas = [...agrupadas].map(([id, itens]) => ({
    id,
    itens: itens.toSorted((a, b) => a.em.localeCompare(b.em)),
    ...identificar(itens[0].conversa, itens),
    vendedor: itens[0].vendedor,
    ultima: itens.reduce((atual, item) => item.em > atual.em ? item : atual),
  })).toSorted((a, b) => b.ultima.em.localeCompare(a.ultima.em))
  const [selecionada, selecionar] = useState(conversas[0]?.id ?? '')
  const conversaAtual = conversas.find(item => item.id === selecionada) ?? conversas[0]
  const termo = normalizar(busca)
  const digitos = busca.replace(/\D/g, '')
  const visiveis = conversas.filter(c => !termo || normalizar(c.nome).includes(termo)
    || (digitos.length >= 3 && /^[\d\s()+.-]+$/.test(busca) && c.telefone?.includes(digitos))
    || c.itens.some(m => normalizar(m.texto).includes(termo)))
  const conversaId = conversaAtual?.id
  useLayoutEffect(() => {
    const lista = rolagem.current
    if (!lista || !conversaId) return
    if (posicao.current.id !== conversaId) {
      lista.scrollTop = lista.scrollHeight
      posicao.current = { id: conversaId, topo: lista.scrollTop, noFim: true }
    } else if (ancora.current?.id === conversaId) {
      lista.scrollTop = ancora.current.topo + lista.scrollHeight - ancora.current.altura
      posicao.current.topo = lista.scrollTop
    } else if (posicao.current.noFim) {
      lista.scrollTop = lista.scrollHeight
      posicao.current.topo = lista.scrollTop
    }
    ancora.current = null
  }, [dados.acumuladas, conversaId])

  return <>
  {!conversaAtual ? <section className={styles.estado} role="status">
    <h2>Nenhuma mensagem carregada</h2>
    <p>{mais ? 'Consulte as próximas páginas do histórico.' : 'As novas mensagens aparecerão automaticamente.'}</p>
  </section> : <section className={styles.painel} aria-label="Conversas carregadas">
    <div className={styles.lista}>
      <div className={styles.listaCabecalho}>
        <h2>Conversas carregadas <small>{conversas.length}</small></h2>
        <label className={styles.busca}><span>Buscar conversa</span><input type="search" value={busca} onChange={e => mudarBusca(e.target.value)} placeholder="Nome, telefone ou mensagem" aria-describedby="alcance-busca" /></label>
        <p id="alcance-busca">Busca nas conversas carregadas.</p>
      </div>
      <div className={styles.conversas} aria-label="Lista de conversas" tabIndex={0} onWheel={e => {
        const el = e.currentTarget
        if (e.deltaY > 0 && !erro && el.scrollHeight - el.clientHeight - el.scrollTop < 80) void carregar()
      }} onScroll={e => {
        const el = e.currentTarget
        if (!erro && el.scrollTop > 0 && el.scrollHeight - el.clientHeight - el.scrollTop < 80) void carregar()
      }}>
        {visiveis.map(conversa => <button key={conversa.id} type="button" className={styles.conversa} aria-current={conversaAtual.id === conversa.id ? 'true' : undefined} onClick={() => selecionar(conversa.id)}>
          <span className={styles.avatar} aria-hidden="true">{iniciais(conversa.nome)}</span>
          <strong>{conversa.nome}{conversa.vendedor && <small className={styles.origem}>{conversa.vendedor}</small>}</strong>
          <span className={styles.previa}>{conversa.ultima.direcao === 'enviada' ? 'Você: ' : ''}{conversa.ultima.texto}</span>
          <time dateTime={conversa.ultima.em}>{horario.format(new Date(conversa.ultima.em))}</time>
        </button>)}
        {visiveis.length === 0 && <div className={styles.semResultado} role="status"><strong>Nenhuma conversa encontrada</strong><p>Tente outro nome ou telefone.{mais ? ' Carregue mais histórico para ampliar a busca.' : ''}</p></div>}
      </div>
    </div>
    <div className={styles.chat}>
      <header className={styles.chatCabecalho}><span className={styles.avatar} aria-hidden="true">{iniciais(conversaAtual.nome)}</span><div><h2>{conversaAtual.nome}</h2><p>{conversaAtual.telefone ?? 'Número não disponibilizado pela integração'}</p>{conversaAtual.vendedor && <p>{conversaAtual.vendedor}</p>}</div><span className={styles.leitura}>Somente visualização</span></header>
      <ol ref={rolagem} className={styles.mensagens} aria-label="Mensagens da conversa" tabIndex={0} onWheel={e => {
        if (e.deltaY < 0 && e.currentTarget.scrollTop < 60 && !erro) void carregar()
      }} onScroll={e => {
        const el = e.currentTarget
        const subindo = el.scrollTop < posicao.current.topo
        posicao.current = { id: conversaAtual.id, topo: el.scrollTop, noFim: el.scrollHeight - el.clientHeight - el.scrollTop < 60 }
        if (subindo && el.scrollTop < 60 && !erro) void carregar()
      }}>{conversaAtual.itens.map((mensagem, i) => <li key={JSON.stringify([mensagem.fonteId, mensagem.conversa, mensagem.id])} className={styles.linhaMensagem}>
        {(i === 0 || dia.format(new Date(mensagem.em)) !== dia.format(new Date(conversaAtual.itens[i - 1].em))) && <span className={styles.dataConversa}>{dia.format(new Date(mensagem.em))}</span>}
        <div className={mensagem.direcao === 'enviada' ? styles.enviada : styles.recebida}>
        {mensagem.midia ? <MidiaMensagem id={mensagem.id} conversa={mensagem.conversa} fonte={mensagem.fonteId} midia={mensagem.midia} /> : <span>{mensagem.texto}</span>}
        <time dateTime={mensagem.em} title={horario.format(new Date(mensagem.em))}>{hora.format(new Date(mensagem.em))}{mensagem.direcao === 'enviada' && <span aria-label="Enviada"> ↗</span>}</time>
        </div>
      </li>)}</ol>
      <footer className={styles.rodape}>{atualizando ? 'Atualizando mensagens…' : 'Atualização automática a cada 15 segundos.'} As respostas continuam no WhatsApp Business do celular.</footer>
    </div>
  </section>}
  <div className={styles.historico}>
    <span aria-live="polite">{dados.acumuladas.length} mensagens carregadas</span>
    {mais && <span className={styles.dicaHistorico}>Role a lista para baixo ou a conversa para cima para carregar mais.</span>}
    {mais && limite ? <button type="button" onClick={carregar} disabled={carregando}>{carregando ? 'Carregando…' : 'Carregar mensagens anteriores'}</button> : <span>Fim do histórico disponível nesta consulta.</span>}
    {erro && <p role="alert">Não foi possível carregar o histórico. Tente novamente.</p>}
    {avisos.length > 0 && <p role="status">Histórico parcial. Indisponível: {avisos.join(', ')}.</p>}
  </div>
  </>
}
