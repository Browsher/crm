import { exigir } from '@/src/server/autenticacao/guarda'
import { consultarFontes } from '@/src/server/whatsapp/consulta'
import Link from 'next/link'
import { PainelWhatsApp } from './painel'
import styles from './whatsapp.module.css'
import { VisaoGeralWhatsApp } from './visao-geral'

export default async function PaginaWhatsApp({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) {
  const eu = await exigir('gestor')
  const parametros = await searchParams
  const filtro = typeof parametros?.vendedor === 'string' ? parametros.vendedor : 'todos'
  const resultado = await consultarFontes(eu.usuarioId, filtro)

  return <main className={styles.pagina}>
    <header className={styles.cabecalho}>
      <div>
        <h1>WhatsApp</h1>
        <p>Acompanhe as conversas e os arquivos em um só lugar.</p>
      </div>
      <div className={styles.identificacao}>{resultado.fontes.length === 1 && resultado.fontes[0].id === 'piloto' && <span className={styles.sobretitulo}>Número de teste</span>}<span className={styles.somenteLeitura}>Somente visualização</span><Link className={styles.configurar} href="/whatsapp/configuracao">Configurar vendedores</Link></div>
    </header>
    {(!resultado.configurado || resultado.fontes.length === 0) && <VisaoGeralWhatsApp opcoes={resultado.opcoes.map(f => ({ id: f.id, nome: f.nome }))} filtro={filtro} />}
    {resultado.fontes.length === 0 ? <section className={styles.estado} role="status"><h2>Nenhuma instância disponível neste filtro</h2><p>Escolha outro vendedor ou configure um vínculo.</p></section> : !resultado.configurado ? <section className={styles.estado} role="status">
      <h2>Integração ainda não configurada</h2>
      <p>Configure a conexão do WhatsApp no servidor do CRM.</p>
    </section> : <PainelWhatsApp key={filtro} opcoes={resultado.opcoes.map(f => ({ id: f.id, nome: f.nome }))} consultaParcial={resultado.avisos.length > 0} fontesAtivas={resultado.fontes.map(f => f.id)} filtro={filtro} cursores={resultado.cursores} mensagens={resultado.mensagens} total={resultado.avisos.length ? undefined : resultado.total} limiteHistorico={resultado.limiteHistorico} temMais={resultado.temMais}>
      {resultado.avisos.length > 0 && <p role="status">Consulta parcial. Indisponível: {resultado.avisos.join(', ')}. A atualização automática tentará novamente.</p>}
    </PainelWhatsApp>}
  </main>
}
