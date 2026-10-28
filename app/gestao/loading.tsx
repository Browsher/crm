import { Card, CardContent } from '@/src/components/ui/card'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Skeleton } from '@/src/components/ui/skeleton'
import styles from './gestao.module.css'

export default function Loading() {
  return <main className={`crm-ui ${styles.pagina}`} aria-busy="true">
    <CabecalhoPagina titulo="Gestão" /><p role="status">Carregando o resumo da equipe...</p>
    <div className={styles.resumo}>{[0, 1, 2, 3].map(i => <Card key={i}><CardContent><Skeleton style={{ height: '6rem' }} /></CardContent></Card>)}</div>
  </main>
}
