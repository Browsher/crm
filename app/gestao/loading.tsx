import { Skeleton } from '@/src/components/ui/skeleton'
import styles from './gestao.module.css'

export default function Loading() {
  return <main className={styles.pagina} aria-busy="true">
    <h1>Gestão</h1><p role="status">Carregando o resumo da equipe...</p>
    <div className={styles.resumo}>{[0, 1, 2, 3].map(i => <Skeleton key={i} style={{ height: '9rem' }} />)}</div>
  </main>
}
