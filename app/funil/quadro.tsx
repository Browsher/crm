'use client'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ETAPAS_FUNIL, proximaEtapa, type EtapaFunil } from '@/src/lib/comercial'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { Button } from '@/src/components/ui/button'
import { ModalFunil } from './modal'
import { ROTULOS_ETAPA } from './rotulos'
import { etapaAcao } from './acoes'
import styles from './funil.module.css'
export function Quadro({linhas}:{linhas:NegociacaoResumo[]}) {
  const [selecionada,setSelecionada]=useState<string|null>(null)
  const [aviso,setAviso]=useState('')
  const [desktop,setDesktop]=useState(false),[pendente,setPendente]=useState(false)
  const [destino,setDestino]=useState<EtapaFunil|null>(null)
  const [movimento,setMovimento]=useState<{base:NegociacaoResumo[];id:string;etapa:EtapaFunil}|null>(null)
  const arraste=useRef<NegociacaoResumo|null>(null),bloqueado=useRef(false),vivo=useRef(true)
  const origem=useRef<HTMLButtonElement|null>(null), mensagem=useRef<HTMLParagraphElement|null>(null)
  const router=useRouter()
  const visiveis=movimento?.base===linhas?linhas.map(l=>l.id===movimento.id?{...l,etapa:movimento.etapa}:l):linhas
  useEffect(()=>{
    const media=window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const atualizar=()=>setDesktop(media.matches)
    atualizar();media.addEventListener('change',atualizar)
    return()=>media.removeEventListener('change',atualizar)
  },[])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  function iniciar(e:DragEvent<HTMLButtonElement>,linha:NegociacaoResumo){
    if(!desktop||bloqueado.current||!proximaEtapa(linha.etapa)){e.preventDefault();return}
    arraste.current=linha;setDestino(proximaEtapa(linha.etapa))
    e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',linha.id)
  }
  async function soltar(e:DragEvent<HTMLElement>,etapa:EtapaFunil){
    e.preventDefault()
    const linha=arraste.current
    arraste.current=null;setDestino(null)
    if(!desktop||bloqueado.current||!linha||proximaEtapa(linha.etapa)!==etapa)return
    if(!visiveis.some(l=>l.id===linha.id&&l.etapa===linha.etapa))return
    bloqueado.current=true;setPendente(true);setAviso('Salvando etapa...')
    setMovimento({base:linhas,id:linha.id,etapa})
    const f=new FormData();f.set('id',linha.id);f.set('anterior',linha.etapa);f.set('etapa',etapa)
    try{
      const r=await etapaAcao(f)
      if(!vivo.current)return
      if(r.ok){setAviso(`Etapa atualizada para ${ROTULOS_ETAPA[etapa]}.`);router.refresh()}
      else {setMovimento(null);setAviso(r.erro??'Não foi possível avançar. Tente novamente.');router.refresh()}
    }catch{if(vivo.current){setMovimento(null);setAviso('Não foi possível confirmar o avanço. Atualize o quadro antes de tentar novamente.');router.refresh()}}
    finally{bloqueado.current=false;if(vivo.current){setPendente(false);requestAnimationFrame(()=>mensagem.current?.focus())}}
  }
  function fechar(texto?:string) {
    setSelecionada(null)
    if(texto){setAviso(texto);router.refresh();requestAnimationFrame(()=>mensagem.current?.focus())}
    else requestAnimationFrame(()=>origem.current?.focus())
  }
  return <>
    <p role="status" tabIndex={-1} ref={mensagem} className={styles.aviso}>{aviso}</p>
    {desktop&&!!linhas.length&&<p className={styles.muted}>Arraste para a próxima etapa ou abra a empresa para avançar.</p>}
    {!linhas.length && <div className={styles.vazio}><h2>Nenhuma negociação aberta</h2><p>Assuma uma empresa na Prospecção para começar.</p><Button asChild><Link href="/fila">Ir para Prospecção</Link></Button></div>}
    <div className={styles.quadro} aria-label="Negociações por etapa">{ETAPAS_FUNIL.map(etapa=>{
      const cards=visiveis.filter(l=>l.etapa===etapa)
      return <section key={etapa} className={`${styles.coluna} ${destino===etapa?styles.destino:''}`} aria-label={ROTULOS_ETAPA[etapa]} aria-busy={pendente} onDragOver={e=>{if(desktop&&!bloqueado.current&&arraste.current&&proximaEtapa(arraste.current.etapa)===etapa)e.preventDefault()}} onDrop={e=>void soltar(e,etapa)}><header><h2>{ROTULOS_ETAPA[etapa]}</h2><span aria-label={`${cards.length} negociações`}>{cards.length}</span></header>
        <div className={styles.cards}>{cards.map(l=><button type="button" key={l.id} className={styles.card} disabled={pendente} draggable={desktop&&!pendente&&proximaEtapa(l.etapa)!==null} onDragStart={e=>iniciar(e,l)} onDragEnd={()=>{arraste.current=null;setDestino(null)}} onClick={e=>{if(bloqueado.current||arraste.current)return;origem.current=e.currentTarget;setSelecionada(l.id)}}><strong>{l.nome}</strong><span>{l.cidade??'Cidade não cadastrada'}</span></button>)}{!cards.length&&<p className={styles.semCards}>Sem negociações nesta etapa.</p>}</div>
      </section>
    })}</div>
    {selecionada&&<ModalFunil key={selecionada} id={selecionada} fechar={fechar} />}
  </>
}
