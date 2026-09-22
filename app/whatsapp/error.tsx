'use client'

import styles from './whatsapp.module.css'
import { Button } from '@/src/components/ui/button'

export default function ErroWhatsApp({ reset }: { error: Error; reset: () => void }) {
  return <main className={styles.pagina}>
    <h1>WhatsApp</h1>
    <section className={styles.estado} role="alert">
      <h2>Não foi possível carregar as mensagens</h2>
      <p>Confira a conexão do WhatsApp e tente novamente.</p>
      <Button type="button" variant="outline" onClick={reset}>Tentar novamente</Button>
    </section>
  </main>
}
