'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ETAPAS_FUNIL } from '@/src/lib/comercial'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { Button } from '@/src/components/ui/button'
import { ModalFunil } from './modal'
import { ROTULOS_ETAPA } from './rotulos'
import styles from './funil.module.css'
export function Quadro({linhas}:{linhas:NegociacaoResumo[]}) {
  const [selecionada,setSelecionada]=useState<string|null>(null)
  const [aviso,setAviso]=useState('')
  const origem=useRef<HTMLButtonElement|null>(null), mensagem=useRef<HTMLParagraphElement|null>(null)
  const router=useRouter()
  function fechar(texto?:string) {
    setSelecionada(null)
    if(texto){setAviso(texto);router.refresh();requestAnimationFrame(()=>mensagem.current?.focus())}
    else requestAnimationFrame(()=>origem.current?.focus())
  }
  return <>
    <p role="status" tabIndex={-1} ref={mensagem} className={styles.aviso}>{aviso}</p>
    {!linhas.length && <div className={styles.vazio}><h2>Nenhuma negociação aberta</h2><p>Assuma uma empresa na Prospecção para começar.</p><Button asChild><Link href="/fila">Ir para Prospecção</Link></Button></div>}
    <div className={styles.quadro} aria-label="Negociações por etapa">{ETAPAS_FUNIL.map(etapa=>{
      const cards=linhas.filter(l=>l.etapa===etapa)
      return <section key={etapa} className={styles.coluna} aria-label={ROTULOS_ETAPA[etapa]}><header><h2>{ROTULOS_ETAPA[etapa]}</h2><span aria-label={`${cards.length} negociações`}>{cards.length}</span></header>
        <div className={styles.cards}>{cards.map(l=><button type="button" key={l.id} className={styles.card} onClick={e=>{origem.current=e.currentTarget;setSelecionada(l.id)}}><strong>{l.nome}</strong><span>{l.cidade??'Cidade não cadastrada'}</span></button>)}{!cards.length&&<p className={styles.semCards}>Sem negociações nesta etapa.</p>}</div>
      </section>
    })}</div>
    {selecionada&&<ModalFunil key={selecionada} id={selecionada} fechar={fechar} />}
  </>
}
