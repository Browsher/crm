'use client'
import { useEffect, useRef, useState, startTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ETAPAS_FUNIL, proximaEtapa, type EtapaFunil } from '@/src/lib/comercial'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { CardEmpresa } from '@/src/components/crm/card-empresa'
import { EmpresaDialogo } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import { ModalFunil } from './modal'
import { CardSemInteresse, type EstadoDescarte } from './card-sem-interesse'
import { ROTULOS_ETAPA } from './rotulos'
import { etapaAcao, semInteresseAcao, type EstadoFunil } from './acoes'
import styles from './funil.module.css'

const STORAGE='crm:funil:arquivo:v1'
type Envio={linha:NegociacaoResumo;chave:string}
function disponivel(l:NegociacaoResumo){return l.empresa.situacao!=='indisponivel'&&l.empresa.negociacaoId===l.id&&l.empresa.versao===l.versao}
function enviar(acao:(form:FormData)=>Promise<EstadoFunil>,form:FormData):Promise<EstadoFunil>{
  // O indicador e a trava são urgentes. Só a chamada remota entra na
  // transição, para que a interface não espere a rede para mostrar salvando.
  return new Promise((resolve,reject)=>startTransition(()=>{acao(form).then(resolve,reject)}))
}
export function Quadro({linhas,totalSemInteresse=0,negociacaoInicial=null,usuarioId}:{linhas:NegociacaoResumo[];totalSemInteresse?:number;negociacaoInicial?:string|null;usuarioId:string}) {
  const storage=STORAGE+':'+usuarioId
  const [selecionada,setSelecionada]=useState<string|null>(negociacaoInicial)
  const [referencia,setReferencia]=useState<ReferenciaEmpresa|null>(null)
  const [aviso,setAviso]=useState('')
  const [desktop,setDesktop]=useState(false),[pendente,setPendente]=useState(false)
  const [arrastando,setArrastando]=useState(false)
  const [destino,setDestino]=useState<EtapaFunil|null>(null),[estado,setEstado]=useState<EstadoDescarte>('repouso')
  const [envio,setEnvio]=useState<Envio|null>(null)
  const [removida,setRemovida]=useState<{base:NegociacaoResumo[];id:string}|null>(null)
  const [movimento,setMovimento]=useState<{base:NegociacaoResumo[];id:string;etapa:EtapaFunil}|null>(null)
  const arraste=useRef<NegociacaoResumo|null>(null),bloqueado=useRef(false),vivo=useRef(true),envioRef=useRef<Envio|null>(null)
  const origem=useRef<HTMLElement|null>(null),mensagem=useRef<HTMLParagraphElement|null>(null)
  const router=useRouter()
  let visiveis=movimento?.base===linhas?linhas.map(l=>l.id===movimento.id?{...l,etapa:movimento.etapa}:l):linhas
  if(removida?.base===linhas)visiveis=visiveis.filter(l=>l.id!==removida.id)
  if(envio&&!visiveis.some(l=>l.id===envio.linha.id))visiveis=[...visiveis,envio.linha]
  useEffect(()=>{
    const media=window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const atualizar=()=>setDesktop(media.matches)
    atualizar();media.addEventListener('change',atualizar)
    const recuperar=()=>{try {const salvo=sessionStorage.getItem(storage);if(salvo){const e=JSON.parse(salvo) as Envio;if(e.linha?.id&&e.chave){envioRef.current=e;setEnvio(e);setEstado('erro');setAviso('Confirme o envio anterior antes de iniciar outra operação.')}}}catch{setAviso('Não foi possível recuperar o envio anterior. Atualize a página.')}}
    recuperar()
    return()=>media.removeEventListener('change',atualizar)
  },[storage])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  function focar(){requestAnimationFrame(()=>mensagem.current?.focus())}
  function iniciar(e:DragEvent<HTMLElement>,linha:NegociacaoResumo){
    if(!desktop||bloqueado.current||envioRef.current||!disponivel(linha)){e.preventDefault();return}
    arraste.current=linha;setArrastando(true);origem.current=e.currentTarget;setDestino(proximaEtapa(linha.etapa));setEstado('repouso')
    e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',linha.id)
  }
  async function arquivar(linha:NegociacaoResumo):Promise<EstadoFunil>{
    if(bloqueado.current)return {ok:false}
    const anterior=envioRef.current
    if(anterior&&anterior.linha.id!==linha.id)return {ok:false,erro:'Confirme o envio anterior.'}
    if(!anterior&&!disponivel(linha))return {ok:false,erro:'Esta empresa está indisponível.'}
    bloqueado.current=true;setPendente(true);setEstado('salvando');setAviso('Confirmando arquivamento...')
    arraste.current=null;setArrastando(false);setDestino(null)
    const comando=anterior??{linha,chave:crypto.randomUUID()}
    try{
      // Persistir antes de transmitir preserva chave, versão e identidade no refresh.
      sessionStorage.setItem(storage,JSON.stringify(comando));envioRef.current=comando;setEnvio(comando)
      const f=new FormData();f.set('id',comando.linha.id);f.set('empresaId',comando.linha.empresaId);f.set('versao',String(comando.linha.versao));f.set('chave',comando.chave)
      const r=await enviar(semInteresseAcao,f)
      if(!vivo.current)return r
      sessionStorage.removeItem(storage);envioRef.current=null;setEnvio(null)
      if(r.ok){
        const sucesso=!r.repetida&&r.atual===true
        setEstado(sucesso?'sucesso':'repouso')
        if(sucesso)setRemovida({base:linhas,id:linha.id})
        setAviso(sucesso?'Empresa marcada como Sem interesse. Retornos cancelados.':r.repetida?'Envio anterior confirmado. Situação atualizada sem repetir o arquivamento.':'Operação confirmada. Confira a situação atual da empresa.')
        router.refresh()
      }else{setEstado('erro');setAviso(r.erro??'Não foi possível arquivar. A empresa foi mantida.')}
      return r
    }catch{
      const erro='Não foi possível confirmar o resultado. Confirme o envio anterior com a mesma chave.'
      if(vivo.current){setEstado('erro');setAviso(erro)}
      return {ok:false,erro}
    }finally{bloqueado.current=false;if(vivo.current){setPendente(false);focar()}}
  }
  async function soltar(e:DragEvent<HTMLElement>,etapa:EtapaFunil){
    e.preventDefault()
    const linha=arraste.current
    arraste.current=null;setArrastando(false);setDestino(null)
    if(!desktop||bloqueado.current||envioRef.current||!linha||!disponivel(linha)||proximaEtapa(linha.etapa)!==etapa)return
    if(!visiveis.some(l=>l.id===linha.id&&l.etapa===linha.etapa))return
    bloqueado.current=true;setPendente(true);setAviso('Salvando etapa...')
    setMovimento({base:linhas,id:linha.id,etapa})
    const f=new FormData();f.set('id',linha.id);f.set('anterior',linha.etapa);f.set('etapa',etapa)
    try{
      const r=await enviar(etapaAcao,f)
      if(!vivo.current)return
      if(r.ok){setAviso('Etapa atualizada para '+ROTULOS_ETAPA[etapa]+'.');router.refresh()}
      else{setMovimento(null);setAviso(r.erro??'Não foi possível avançar. Tente novamente.')}
    }catch{if(vivo.current){setMovimento(null);setAviso('Não foi possível confirmar o avanço. Atualize o quadro antes de tentar novamente.')}}
    finally{bloqueado.current=false;if(vivo.current){setPendente(false);focar()}}
  }
  function fechar(texto?:string){
    setSelecionada(null)
    if(negociacaoInicial)history.replaceState(history.state,'','/funil')
    if(texto){setAviso(texto);router.refresh();focar()}
    else requestAnimationFrame(()=>origem.current?.focus())
  }
  return <>
    <p role="status" tabIndex={-1} ref={mensagem} className={styles.aviso}>{aviso}</p>
    {envio&&!pendente&&<Button variant="outline" onClick={()=>void arquivar(envio.linha)}>Confirmar envio anterior</Button>}
    <CardSemInteresse estado={estado} total={totalSemInteresse} aceitaArraste={desktop&&!pendente&&!envio&&arrastando} aoMudarSobre={sobre=>{if(!bloqueado.current)setEstado(sobre?'sobre':'repouso')}} aoSoltar={()=>{const linha=arraste.current;if(linha)void arquivar(linha)}}/>
    {desktop&&!!linhas.length&&<p className={styles.muted}>Arraste para a próxima etapa ou para Sem interesse. As ações do card também funcionam por teclado e toque.</p>}
    {!linhas.length&&!envio&&<EstadoVazio titulo="Nenhuma negociação aberta" descricao="Registre interesse ou combine um retorno no atendimento para começar." acao={{rotulo:'Ir para Prospecção',href:'/fila'}}/>}
    <div className={styles.quadro} aria-label="Negociações por etapa">{ETAPAS_FUNIL.map(etapa=>{
      const cards=visiveis.filter(l=>l.etapa===etapa)
      return <section data-etapa={etapa} key={etapa} className={styles.coluna+' '+(destino===etapa?styles.destino:'')} aria-label={ROTULOS_ETAPA[etapa]} aria-busy={pendente} onDragOver={e=>{if(desktop&&!bloqueado.current&&arraste.current&&proximaEtapa(arraste.current.etapa)===etapa)e.preventDefault()}} onDrop={e=>void soltar(e,etapa)}>
        <header><h2>{ROTULOS_ETAPA[etapa]}</h2><span aria-label={cards.length+' negociações'}>{cards.length}</span></header>
        <div className={styles.cards}>{cards.map(l=><div key={l.id} className={styles.arrastavel} tabIndex={-1} draggable={desktop&&!pendente&&!envio&&disponivel(l)} onDragStart={e=>iniciar(e,l)} onDragEnd={()=>{arraste.current=null;setArrastando(false);setDestino(null);if(!bloqueado.current)setEstado('repouso')}}>
          <fieldset disabled={pendente||!!envio} className={styles.conteudoCard}>
            <CardEmpresa empresa={l.empresa} aoVer={setReferencia} aoAcionar={acao=>{if(!bloqueado.current&&!envioRef.current){origem.current=document.activeElement as HTMLElement;if(acao.tipo==='funil')setSelecionada(l.id);else if('href' in acao)router.push(acao.href)}}}/>
            {disponivel(l)&&<Button variant="ghost" onClick={()=>void arquivar(l)}>Marcar como Sem interesse</Button>}
          </fieldset>
        </div>)}{!cards.length&&<p className={styles.semCards}>Sem negociações nesta etapa.</p>}</div>
      </section>
    })}</div>
    {referencia&&<EmpresaDialogo referencia={referencia} aoFechar={()=>setReferencia(null)}/>}
    {selecionada&&<ModalFunil key={selecionada} id={selecionada} fechar={fechar} bloqueada={!!envio&&!pendente} aoArquivar={()=>{const linha=visiveis.find(l=>l.id===selecionada);return linha?arquivar(linha):Promise.resolve({ok:false,erro:'Atualize o Funil antes de arquivar.'})}}/>}
  </>
}
