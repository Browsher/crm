'use client'

import { ChevronRight } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import styles from './painel-comum.module.css'

type Item = { id: string; titulo: string; descricao?: string; desabilitado?: boolean; aoAbrir: (gatilho: HTMLButtonElement) => void }

export function MenuPainelCrm({ rotulo, itens }: { rotulo: string; itens: readonly Item[] }) {
  return <nav aria-label={rotulo} className={styles.menu}>
    {itens.map(item => <Button key={item.id} id={item.id} type="button" variant="ghost" className={styles.item}
      disabled={item.desabilitado} onClick={evento => item.aoAbrir(evento.currentTarget)}>
      <span><strong>{item.titulo}</strong>{item.descricao && <small>{item.descricao}</small>}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </Button>)}
  </nav>
}
