import type { ReactElement, ReactNode } from 'react'
import { Card, CardContent } from '@/src/components/ui/card'
import { cn } from '@/src/lib/ui-utils'
import styles from './composicoes.module.css'

type Props = {
  children: ReactNode
  acoes: ReactNode
  descricao?: ReactNode
  className?: string
}

export function PainelFiltros({ children, acoes, descricao, className }: Props): ReactElement {
  return <Card className={cn(styles.painelFiltros, className)}>
    {descricao ? <CardContent className={styles.descricaoFiltros}>{descricao}</CardContent> : null}
    <CardContent className={styles.conteudoFiltros}>
      {children}
      <div className={styles.acoesFiltros}>{acoes}</div>
    </CardContent>
  </Card>
}
