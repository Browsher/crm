'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Mensagem } from '@/src/server/whatsapp/evolution'
import styles from './whatsapp.module.css'
import { historicoMensagensAcao } from './historico-acao'
import { telefoneDoJid } from '@/src/lib/whatsapp-identificacao'

const horario = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

function identificar(jid: string, itens: Mensagem[]) {
  const telefones = [...new Set(itens.map(m => m.telefone).filter((t): t is string => !!t && /^\+[1-9]\d{6,14}$/.test(t)))]
  const telefone = telefoneDoJid(jid) ?? (jid.endsWith('@lid') && telefones.length === 1 ? telefones[0] : null)
  const nome = itens.toSorted((a, b) => b.em.localeCompare(a.em))
    .find(m => m.direcao === 'recebida' && m.nome?.trim() && !/^\d+$/.test(m.nome.trim()))?.nome?.trim()
  return { nome: nome ?? telefone ?? 'Contato não identificado', telefone }
}

function mesclar(anteriores: Mensagem[], novas: Mensagem[]) {
  return [...new Map([...anteriores, ...novas].map(m => [JSON.stringify([m.conversa, m.id]), m])).values()]
}

export function PainelWhatsApp({ mensagens, limiteHistorico, temMais = false }: {
  mensagens: Mensagem[], limiteHistorico?: string, temMais?: boolean
}) {
  const [dados, guardar] = useState({ amostra: mensagens, acumuladas: mesclar([], mensagens) })
  if (dados.amostra !== mensagens) guardar({ amostra: mensagens, acumuladas: mesclar(dados.acumuladas, mensagens) })
  const [limite] = useState(limiteHistorico)
  const [pagina, mudarPagina] = useState(2)
  const [mais, mudarMais] = useState(temMais)
  const [carregando, mudarCarregando] = useState(false)
  const [erro, mudarErro] = useState(false)
  const requisicao = useRef(false)
  async function carregar() {
    if (requisicao.current || !mais || !limite) return
    requisicao.current = true
    mudarCarregando(true)
    mudarErro(false)
    try {
      const resultado = await historicoMensagensAcao(pagina, limite)
      if (!resultado.ok) { mudarErro(true); return }
      guardar(atual => ({ ...atual, acumuladas: mesclar(resultado.mensagens, atual.acumuladas) }))
      mudarMais(resultado.temMais)
      mudarPagina(atual => atual + 1)
    } catch {
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
    const conversa = agrupadas.get(mensagem.conversa) ?? []
    conversa.push(mensagem)
    agrupadas.set(mensagem.conversa, conversa)
  }
  const conversas = [...agrupadas].map(([id, itens]) => ({
    id,
    itens: itens.toSorted((a, b) => a.em.localeCompare(b.em)),
    ...identificar(id, itens),
    ultima: itens.reduce((atual, item) => item.em > atual.em ? item : atual),
  })).toSorted((a, b) => b.ultima.em.localeCompare(a.ultima.em))
  const [selecionada, selecionar] = useState(conversas[0]?.id ?? '')
  const conversaAtual = conversas.find(item => item.id === selecionada) ?? conversas[0]

  return <>
  {!conversaAtual ? <section className={styles.estado} role="status">
    <h2>Nenhuma mensagem carregada</h2>
    <p>{mais ? 'Consulte as próximas páginas do histórico.' : 'As novas mensagens aparecerão automaticamente.'}</p>
  </section> : <section className={styles.painel} aria-label="Conversas carregadas">
    <div className={styles.lista}>
      <h2>Conversas carregadas <small>{conversas.length}</small></h2>
      <div className={styles.conversas}>
        {conversas.map(conversa => <button key={conversa.id} type="button" className={styles.conversa} aria-current={conversaAtual.id === conversa.id ? 'true' : undefined} onClick={() => selecionar(conversa.id)}>
          <strong>{conversa.nome}</strong>
          <span>{conversa.ultima.texto}</span>
          <time dateTime={conversa.ultima.em}>{horario.format(new Date(conversa.ultima.em))}</time>
        </button>)}
      </div>
    </div>
    <div className={styles.chat}>
      <header className={styles.chatCabecalho}><div><h2>{conversaAtual.nome}</h2><p>{conversaAtual.telefone ?? 'Número não disponibilizado pela integração'}</p></div><span>Somente visualização</span></header>
      <ol className={styles.mensagens}>{conversaAtual.itens.map(mensagem => <li key={mensagem.id} className={mensagem.direcao === 'enviada' ? styles.enviada : styles.recebida}>
        <span>{mensagem.texto}</span>
        <time dateTime={mensagem.em}>{horario.format(new Date(mensagem.em))}</time>
      </li>)}</ol>
      <footer className={styles.rodape}>{atualizando ? 'Atualizando mensagens…' : 'Atualização automática a cada 15 segundos.'} As respostas continuam no WhatsApp Business do celular.</footer>
    </div>
  </section>}
  <div className={styles.historico}>
    <span aria-live="polite">{dados.acumuladas.length} mensagens carregadas</span>
    {mais && limite ? <button type="button" onClick={carregar} disabled={carregando}>{carregando ? 'Carregando…' : 'Carregar mensagens anteriores'}</button> : <span>Fim do histórico disponível nesta consulta.</span>}
    {erro && <p role="alert">Não foi possível carregar o histórico. Tente novamente.</p>}
  </div>
  </>
}
