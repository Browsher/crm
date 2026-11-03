import Link from 'next/link'
import { urlConfiguracaoWhatsApp, type RetornoWhatsApp } from '@/src/lib/retorno-gestor'
import styles from './whatsapp.module.css'

export function CabecalhoWhatsApp({ piloto, retorno }: { piloto: boolean; retorno: RetornoWhatsApp }) {
  return <header className={styles.cabecalho}>
    <div>
      <h1>WhatsApp</h1>
      <p>Acompanhe as conversas e os arquivos em um só lugar.</p>
    </div>
    <div className={styles.identificacao}>
      {piloto && <span className={styles.sobretitulo}>Número de teste</span>}
      <span className={styles.somenteLeitura}>Somente visualização</span>
      <Link className={styles.configurar} href={urlConfiguracaoWhatsApp(retorno)}>Configurar vendedores</Link>
    </div>
  </header>
}
