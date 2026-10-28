'use client'

import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Alert, AlertTitle, AlertDescription } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import styles from './gestao.module.css'

export default function Erro() {
  return <main className={`crm-ui ${styles.pagina}`}>
    <CabecalhoPagina titulo="Gestão" />
    <Alert variant="danger"><AlertTitle>Não foi possível carregar o resumo da equipe.</AlertTitle>
      <AlertDescription>Tente atualizar a página em alguns instantes.</AlertDescription></Alert>
    <div className={styles.atalhos}><Button asChild variant="outline"><a href="/gestao">Tentar novamente</a></Button></div>
  </main>
}
