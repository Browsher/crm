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
        <p className={styles.sobretitulo}>Piloto · Número de teste</p>
        <h1>WhatsApp</h1>
        <p>Visualização das mensagens da instância de suporte. Ainda não há vínculo com vendedores.</p>
      </div>
      <span className={styles.somenteLeitura}>Somente visualização</span>
    </header>
    {!resultado.configurado ? <section className={styles.estado} role="status">
      <h2>Integração ainda não configurada</h2>
      <p>Configure a URL, a chave e o nome da instância da Evolution no servidor do CRM.</p>
    </section> : <>
      <div className={styles.resumo}>
        <strong>{resultado.total.toLocaleString('pt-BR')} {resultado.total === 1 ? 'mensagem' : 'mensagens'} na Evolution</strong>
        <span>Amostra recente de até 50 mensagens. O histórico completo pode não aparecer aqui.</span>
      </div>
      <PainelWhatsApp mensagens={resultado.mensagens} />
    </>}
  </main>
}
