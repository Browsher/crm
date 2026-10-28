'use client'

import styles from './whatsapp.module.css'
import { Button } from '@/src/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'

export default function ErroWhatsApp({ reset }: { error: Error; reset: () => void }) {
  return <main className={styles.pagina}>
    <h1>WhatsApp</h1>
    <Alert variant="danger">
      <AlertTitle><h2>Não foi possível carregar as mensagens</h2></AlertTitle>
      <AlertDescription>Confira a conexão do WhatsApp e tente novamente.</AlertDescription>
      <Button type="button" variant="outline" onClick={reset}>Tentar novamente</Button>
    </Alert>
  </main>
}
