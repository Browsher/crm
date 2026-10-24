import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import styles from './composicoes.module.css'

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return <div className={styles.vazio}><Inbox size={28} aria-hidden="true" /><h2>{titulo}</h2><p>{descricao}</p>{acao}</div>
}
