import styles from './whatsapp.module.css'
import Link from 'next/link'
import type { IndicadoresWhatsApp } from '@/src/lib/whatsapp-indicadores'

const indicadores = [
  { titulo: 'Conversas hoje', desenho: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z' },
  { titulo: 'Sem resposta', desenho: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
  { titulo: 'Vendedores ativos hoje', desenho: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8' },
  { titulo: 'Tempo médio de resposta', desenho: 'M4 20V14h3v6 M11 20V9h3v11 M18 20V3h3v17' },
]

export function VisaoGeralWhatsApp({ opcoes = [], filtro = 'todos', valores, estado = 'Ainda não configurado' }: {
  opcoes?: { id: string; nome: string }[]; filtro?: string; valores?: IndicadoresWhatsApp; estado?: string
}) {
  const numeros = valores ? [String(valores.conversasHoje), String(valores.semResposta), valores.vendedores ? `${valores.ativosHoje} de ${valores.vendedores}` : '—', valores.mediaMinutos === null ? '—' : valores.mediaMinutos > 0 && valores.mediaMinutos < 1 ? '< 1 min' : `${Math.round(valores.mediaMinutos)} min`] : []
  const ajudas = valores ? ['Atividade hoje, horário de Brasília', 'Última mensagem recebida do cliente', valores.vendedores ? 'Enviaram mensagens hoje' : 'Nenhum vendedor neste filtro', valores.mediaMinutos === null ? 'Sem respostas hoje' : 'Respostas de hoje · Seg a sex · 9h às 18h · Brasília'] : []
  return <>
    <section className={styles.indicadores} aria-label="Indicadores de atendimento">
      {indicadores.map((indicador, i) => <article key={indicador.titulo} className={styles.indicador}>
        <svg className={i === 1 ? styles.iconePendente : styles.iconeIndicador} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={indicador.desenho} /></svg>
        <div><h2>{indicador.titulo}</h2><p className={styles.valorIndicador} aria-label={!valores ? 'Indicador indisponível' : undefined}>{numeros[i] ?? '—'}</p><p className={styles.ajudaIndicador}>{ajudas[i] ?? estado}</p></div>
      </article>)}
    </section>
    <section className={styles.filtroVendedores} aria-labelledby="titulo-vendedores">
      <div className={styles.tituloVendedores}><h2 id="titulo-vendedores">Filtrar por vendedor</h2>{!opcoes.some(f => f.id !== 'piloto') && <p>Nenhum vendedor vinculado. Configure os vendedores para começar.</p>}</div>
      <div className={styles.opcoesVendedores}>
        <Link href="/whatsapp" className={filtro === 'todos' ? styles.todosSelecionado : styles.pilotoVendedor} aria-current={filtro === 'todos' ? 'page' : undefined}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={indicadores[2].desenho} /></svg>Todos</Link>
        {opcoes.map(f => <Link key={f.id} href={`/whatsapp?vendedor=${encodeURIComponent(f.id)}`} className={filtro === f.id ? styles.todosSelecionado : styles.pilotoVendedor} aria-current={filtro === f.id ? 'page' : undefined}><span className={styles.avatarPiloto} aria-hidden="true">{f.id === 'piloto' ? 'T' : f.nome.slice(0, 1).toUpperCase()}</span><span>{f.nome}{f.id === 'piloto' && <small>Piloto</small>}</span></Link>)}
      </div>
    </section>
  </>
}
