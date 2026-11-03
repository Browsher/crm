'use client'
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { chaveSessaoVenda, formularioVenda, lerComandoVenda, limparVendaConfirmada, persistirComandoVenda, type ComandoVenda, type EstadoVenda } from './venda-envio'
const EVENTO = 'crm-venda'
const CONFIRMADA = 'crm-venda-confirmada'
function assinar(avisar:()=>void) { window.addEventListener(EVENTO,avisar); return ()=>window.removeEventListener(EVENTO,avisar) }
function snapshot(usuarioId:string) { try { return sessionStorage.getItem(chaveSessaoVenda(usuarioId)) ?? '' } catch { return '!erro' } }
function avisar() { window.dispatchEvent(new Event(EVENTO)) }
export function useEnvioVenda(usuarioId:string, acao:(form:FormData,comando:ComandoVenda)=>Promise<EstadoVenda>) {
  const bruto = useSyncExternalStore(assinar,()=>snapshot(usuarioId),()=>null)
  const [pendente,setPendente]=useState(false),[erro,setErro]=useState(''),[resultado,setResultado]=useState<EstadoVenda|null>(null)
  const [confirmada,setConfirmada]=useState<string|null>(null)
  const trava=useRef(false),vivo=useRef(true)
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const receber=(evento:Event)=>{
      const comando=(evento as CustomEvent<ComandoVenda>).detail
      if(comando.usuarioId!==usuarioId)return
      // Outro consumidor só reconhece o comando ainda correspondente. Uma
      // resposta antiga não encerra o editor nem a guarda de outra intenção.
      try{
        const atual=lerComandoVenda(usuarioId)
        if(atual&&JSON.stringify(atual)===JSON.stringify(comando))setConfirmada(comando.chave)
      }catch{/* O emissor mantém seu recibo mesmo com armazenamento indisponível. */}
    }
    window.addEventListener(CONFIRMADA,receber)
    return()=>window.removeEventListener(CONFIRMADA,receber)
  },[usuarioId])
  let comando:ComandoVenda|null=null,erroLeitura=''
  try { if(bruto) comando=lerComandoVenda(usuarioId) } catch { erroLeitura='Não foi possível recuperar a venda anterior. Preserve esta aba e atualize a página.' }
  const bloqueada=bruto===null||!!erroLeitura||!!comando
  if(comando?.chave===confirmada)comando=null
  function iniciarNovo():boolean {
    if(trava.current)return false
    try{if(lerComandoVenda(usuarioId))return false}catch{return false}
    setResultado(null);setErro('');setConfirmada(null)
    return true
  }
  async function enviar(novo?:ComandoVenda):Promise<EstadoVenda|undefined> {
    if(trava.current||bruto===null)return
    trava.current=true;setPendente(true);setErro('')
    let envio:ComandoVenda,primeiraTransmissao=false
    try {
      const anterior=lerComandoVenda(usuarioId)
      if(novo && (novo.usuarioId!==usuarioId || anterior && JSON.stringify(novo)!==JSON.stringify(anterior)))throw Error('Confirme o envio anterior')
      primeiraTransmissao=!anterior&&!!novo
      if(primeiraTransmissao){setResultado(null);setConfirmada(null)}
      envio=anterior??novo!
      if(!envio)throw Error('Comando ausente')
      // Persistir antes de qualquer chamada; jamais substituir uma venda incerta.
      persistirComandoVenda(envio);avisar()
    } catch {
      if(vivo.current){setErro('Não foi possível armazenar a venda. Nenhum novo envio foi feito. Preserve esta aba e confira o envio anterior.');setPendente(false)}
      trava.current=false;return
    }
    let r:EstadoVenda
    try {
      r=await new Promise<EstadoVenda>((resolve,reject)=>startTransition(()=>{acao(formularioVenda(envio),envio).then(resolve,reject)}))
    } catch {
      if(vivo.current){setErro('Não foi possível confirmar o resultado. Confirme o envio anterior com os mesmos dados.');setPendente(false)}
      trava.current=false;return
    }
    // A resposta da RPC é definitiva para sucesso. Limpeza local não a desfaz.
    // Somente a resposta explícita de campos da primeira transmissão deste
    // ciclo permite corrigir. Essa prova nunca é restaurada do armazenamento.
    if(r.ok||r.recusaConclusiva||primeiraTransmissao&&vivo.current&&r.erroDeCampos){
      if(vivo.current&&r.ok)setConfirmada(envio.chave)
      try { limparVendaConfirmada(envio);avisar() } catch {
        if(r.ok)r={...r,aviso:'Venda registrada. Não foi possível limpar o envio desta aba. Atualize a página para conferir.'}
      }
    }
    if(r.ok)window.dispatchEvent(new CustomEvent(CONFIRMADA,{detail:envio}))
    if(vivo.current){setResultado(r);setErro(r.ok?'':r.erro);setPendente(false)}
    trava.current=false
    return r
  }
  return {comando,pendente,erro:erro||erroLeitura,resultado,bloqueada,iniciarNovo,enviar}
}
