import type { ReactNode } from 'react'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import styles from './painel-comum.module.css'

export function ConfirmacaoPainelCrm({ titulo, descricao, alvo, acoes, children }: {
  titulo: string
  descricao: ReactNode
  alvo: ReactNode
  acoes: ReactNode
  children?: ReactNode
}) {
  return <>
    <DialogHeader>
      <DialogTitle>{titulo}</DialogTitle>
      <div data-confirmacao-alvo className={styles.alvoConfirmacao}>{alvo}</div>
      <DialogDescription>{descricao}</DialogDescription>
    </DialogHeader>
    {children}
    <DialogFooter className={styles.acoesConfirmacao}>{acoes}</DialogFooter>
  </>
}
