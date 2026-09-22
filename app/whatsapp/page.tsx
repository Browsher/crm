import { exigir } from '@/src/server/autenticacao/guarda'
import { lerMensagensRecentes } from '@/src/server/whatsapp/evolution'
import { PainelWhatsApp } from './painel'
import styles from './whatsapp.module.css'

export default async function PaginaWhatsApp() {
  await exigir('gestor')
  const resultado = await lerMensagensRecentes()

  return <main className={styles.pagina}>
    <header className={styles.cabecalho}>
      <div>
        <h1>WhatsApp</h1>
        <p>Acompanhe as conversas e os arquivos em um só lugar.</p>
      </div>
      <div className={styles.identificacao}><span className={styles.sobretitulo}>Número de teste</span><span className={styles.somenteLeitura}>Somente visualização</span></div>
    </header>
    {!resultado.configurado ? <section className={styles.estado} role="status">
      <h2>Integração ainda não configurada</h2>
      <p>Configure a URL, a chave e o nome da instância da Evolution no servidor do CRM.</p>
    </section> : <>
      <div className={styles.resumo}>
        <strong>{resultado.total.toLocaleString('pt-BR')} {resultado.total === 1 ? 'mensagem' : 'mensagens'} na Evolution</strong>
        <span>Histórico disponível para consulta. As respostas continuam pelo celular.</span>
      </div>
      <PainelWhatsApp mensagens={resultado.mensagens} limiteHistorico={resultado.limiteHistorico} temMais={resultado.temMais} />
    </>}
  </main>
}
