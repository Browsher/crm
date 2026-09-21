'use client'

import { useState } from 'react'
import type { Mensagem } from '@/src/server/whatsapp/evolution'
import styles from './whatsapp.module.css'

const horario = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})

function identificacao(jid: string): string {
  if (jid.endsWith('@s.whatsapp.net')) return `+${jid.slice(0, -'@s.whatsapp.net'.length)}`
  if (jid.endsWith('@lid')) return 'Contato sem número disponível'
  return 'Contato não identificado'
}

export function PainelWhatsApp({ mensagens }: { mensagens: Mensagem[] }) {
  const agrupadas = new Map<string, Mensagem[]>()
  for (const mensagem of mensagens) {
    const conversa = agrupadas.get(mensagem.conversa) ?? []
    conversa.push(mensagem)
    agrupadas.set(mensagem.conversa, conversa)
  }
  const conversas = [...agrupadas].map(([id, itens]) => ({
    id,
    itens: itens.toSorted((a, b) => a.em.localeCompare(b.em)),
    nome: itens.find(item => item.direcao === 'recebida' && item.nome)?.nome ?? identificacao(id),
    ultima: itens.reduce((atual, item) => item.em > atual.em ? item : atual),
  })).toSorted((a, b) => b.ultima.em.localeCompare(a.ultima.em))
  const [selecionada, selecionar] = useState(conversas[0]?.id ?? '')
  const conversaAtual = conversas.find(item => item.id === selecionada) ?? conversas[0]

  if (!conversas.length) return <section className={styles.estado} role="status">
    <h2>Nenhuma mensagem na amostra recente</h2>
    <p>A instância pode ter mensagens em outras páginas do histórico.</p>
  </section>

  return <section className={styles.painel} aria-label="Conversas da amostra recente">
    <div className={styles.lista}>
      <h2>Conversas na amostra <small>{conversas.length}</small></h2>
      <div className={styles.conversas}>
        {conversas.map(conversa => <button key={conversa.id} type="button" className={styles.conversa} aria-current={conversaAtual.id === conversa.id ? 'true' : undefined} onClick={() => selecionar(conversa.id)}>
          <strong>{conversa.nome}</strong>
          <span>{conversa.ultima.texto}</span>
          <time dateTime={conversa.ultima.em}>{horario.format(new Date(conversa.ultima.em))}</time>
        </button>)}
      </div>
    </div>
    <div className={styles.chat}>
      <header className={styles.chatCabecalho}><div><h2>{conversaAtual.nome}</h2><p>{identificacao(conversaAtual.id)}</p></div><span>Somente visualização</span></header>
      <ol className={styles.mensagens}>{conversaAtual.itens.map(mensagem => <li key={mensagem.id} className={mensagem.direcao === 'enviada' ? styles.enviada : styles.recebida}>
        <span>{mensagem.texto}</span>
        <time dateTime={mensagem.em}>{horario.format(new Date(mensagem.em))}</time>
      </li>)}</ol>
      <footer className={styles.rodape}>As respostas continuam no WhatsApp Business do celular.</footer>
    </div>
  </section>
}
