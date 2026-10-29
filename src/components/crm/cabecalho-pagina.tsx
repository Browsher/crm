import type { ReactNode } from 'react'
import styles from './composicoes.module.css'

export function CabecalhoPagina({ titulo, descricao, acoes, className }: { titulo: string; descricao?: string; acoes?: ReactNode; className?: string }) {
  return <header className={[styles.cabecalho, className].filter(Boolean).join(' ')}><div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>{acoes && <div className={styles.acoes}>{acoes}</div>}</header>
}
