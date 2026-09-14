'use client'

import { Alert, AlertTitle, AlertDescription } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import styles from './gestao.module.css'

export default function Erro() {
  return <main className={styles.pagina}>
    <h1>Gestão</h1>
    <Alert variant="danger"><AlertTitle>Não foi possível carregar o resumo da equipe.</AlertTitle>
      <AlertDescription>Tente atualizar a página em alguns instantes.</AlertDescription></Alert>
    <div className={styles.atalhos}><Button asChild variant="outline"><a href="/gestao">Tentar novamente</a></Button></div>
  </main>
}
