import styles from './whatsapp.module.css'

const indicadores = [
  { titulo: 'Conversas hoje', desenho: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z' },
  { titulo: 'Sem resposta', desenho: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z' },
  { titulo: 'Vendedores ativos hoje', desenho: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8' },
  { titulo: 'Tempo médio de resposta', desenho: 'M4 20V14h3v6 M11 20V9h3v11 M18 20V3h3v17' },
]

export function VisaoGeralWhatsApp() {
  return <>
    <section className={styles.indicadores} aria-label="Indicadores de atendimento">
      {indicadores.map((indicador, i) => <article key={indicador.titulo} className={styles.indicador}>
        <svg className={i === 1 ? styles.iconePendente : styles.iconeIndicador} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={indicador.desenho} /></svg>
        <div><h2>{indicador.titulo}</h2><p className={styles.valorIndicador} aria-label="Indicador indisponível">—</p><p className={styles.ajudaIndicador}>Ainda não configurado</p></div>
      </article>)}
    </section>
    <section className={styles.filtroVendedores} aria-labelledby="titulo-vendedores">
      <div className={styles.tituloVendedores}><h2 id="titulo-vendedores">Filtrar por vendedor</h2><p id="ajuda-vendedores">Nenhum vendedor vinculado. Exibindo apenas o número de teste.</p></div>
      <div className={styles.opcoesVendedores}>
        <span className={styles.todosSelecionado} aria-current="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={indicadores[2].desenho} /></svg>Todos</span>
        <span className={styles.pilotoVendedor}><span className={styles.avatarPiloto} aria-hidden="true">T</span><span>Número de teste<small>Piloto</small></span></span>
        <button type="button" className={styles.vendedoresPendentes} aria-describedby="ajuda-vendedores" disabled>Vendedores <span>Aguardando vínculo</span></button>
      </div>
    </section>
  </>
}
