'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert } from '@/src/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/src/components/ui/dialog'
import { useTemaCrm } from '@/src/components/crm/tema'
import { vendaCarteiraAcao } from './venda-acao'
import { vendaAcao } from '../funil/acoes'
import { criarComandoVenda, type EstadoVenda } from '@/src/lib/venda-envio'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'

type PropsVenda = {usuarioId:string;empresaId:string;nome:string;disabled?:boolean}
export function RegistrarVenda(props:PropsVenda) {return <VendaUsuario key={props.usuarioId+':'+props.empresaId} {...props}/>}
function VendaUsuario({usuarioId,empresaId,nome,disabled=false}:PropsVenda) {
  const [aberto,setAberto]=useState(false),[mensagem,setMensagem]=useState('')
  const venda=useEnvioVenda(usuarioId,(f,c)=>c.alvo.tipo==='primeira'?vendaAcao(f):vendaCarteiraAcao(f))
  const router=useRouter(),vivo=useRef(true)
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  function confirmar(r:Extract<EstadoVenda,{ok:true}>,primeira=false){
    setMensagem(r.aviso??'Venda registrada.')
    try{
      if(primeira){
        if(r.leituraDestino?.ok)router.replace('/carteira/'+r.leituraDestino.destino.empresaId+'?venda=registrada')
        else setMensagem('Venda registrada. Não foi possível abrir a ficha. Abra a Carteira.')
      }else router.refresh()
    }catch{setMensagem('Venda registrada. Atualize a página para conferir o histórico.')}
  }
  async function recuperar(){
    const primeira=venda.comando?.alvo.tipo==='primeira'
    const r=await venda.enviar()
    if(vivo.current&&r?.ok)confirmar(r,primeira)
  }
  return <div className="space-y-3">
    {mensagem&&<p role="status">{mensagem}</p>}
    {!aberto&&venda.erro&&<Alert variant="danger" role="alert">{venda.erro}</Alert>}
    {venda.comando&&<section aria-label="Venda pendente"><p>Venda de R$ {venda.comando.entrada.valor} em {venda.comando.entrada.data.split('-').reverse().join('/')}. Os dados do envio anterior foram preservados.</p><Button disabled={venda.pendente} variant="outline" onClick={()=>void recuperar()}>{venda.pendente?'Confirmando venda...':'Confirmar venda anterior'}</Button></section>}
    <Dialog open={aberto} onOpenChange={valor=>{if(valor&&venda.iniciarNovo()){setMensagem('');setAberto(true)}}}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled||venda.bloqueada||venda.pendente}>Registrar venda</Button></DialogTrigger>
      {aberto?<FormularioVenda usuarioId={usuarioId} empresaId={empresaId} nome={nome} venda={venda} fechar={()=>setAberto(false)} aoConfirmar={confirmar}/>:null}
    </Dialog>
  </div>
}

function FormularioVenda({usuarioId,empresaId,nome,venda,fechar,aoConfirmar}:{usuarioId:string;empresaId:string;nome:string;venda:ReturnType<typeof useEnvioVenda>;fechar:()=>void;aoConfirmar:(r:Extract<EstadoVenda,{ok:true}>)=>void}) {
  const tema=useTemaCrm()
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<'fechar'|'voltar'|null>(null)
  const [pendente,setPendente]=useState(false)
  const bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const removendoSentinela=useRef(false),depoisDeRemover=useRef<(()=>void)|null>(null),finalizando=useRef(false)
  const sujo=!venda.resultado?.ok&&!!(valor||data||nota),sujoRef=useRef(sujo)
  useEffect(()=>{sujoRef.current=sujo},[sujo])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(sujoRef.current||bloqueado.current)e.preventDefault()}
    const voltar=(e:PopStateEvent)=>{
      if(removendoSentinela.current){
        removendoSentinela.current=false
        const continuar=depoisDeRemover.current;depoisDeRemover.current=null
        requestAnimationFrame(()=>{
          if(!vivo.current)return
          continuar?.()
          if(sujoRef.current&&!finalizando.current&&!sentinela.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__vendaCarteira:s},'',location.href)}
        })
        return
      }
      const s=sentinela.current
      if(!s||e.state?.__vendaCarteira===s)return
      history.pushState({...history.state,__vendaCarteira:s},'',location.href)
      if(!bloqueado.current)setDescarte('voltar')
    }
    window.addEventListener('beforeunload',unload);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((sujo||pendente)&&!sentinela.current&&!removendoSentinela.current&&!finalizando.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__vendaCarteira:s},'',location.href)}
  },[sujo,pendente])
  function concluir(depois?:()=>void){
    if(finalizando.current)return
    finalizando.current=true
    const continuar=()=>{if(vivo.current){fechar();depois?.()}}
    if(removendoSentinela.current){depoisDeRemover.current=continuar;return}
    if(!sentinela.current){continuar();return}
    sentinela.current=null;removendoSentinela.current=true;depoisDeRemover.current=continuar;history.back()
  }
  function pedirFechar(){if(bloqueado.current)return;if(venda.comando){concluir();return}if(sujo){setDescarte('fechar');return}concluir()}
  function descartar(){if(venda.comando)return;if(descarte==='voltar'){sentinela.current=null;history.go(-2);fechar()}else concluir()}
  async function salvar(){
    if(bloqueado.current||finalizando.current||venda.resultado?.ok||!confirmado)return
    bloqueado.current=true;setPendente(true)
    const comando=venda.comando??criarComandoVenda(usuarioId,empresaId,{tipo:'recompra'},{valor,data,observacao:nota})
    const r=await venda.enviar(comando)
    if(vivo.current){
      if(r?.ok)concluir(()=>aoConfirmar(r))
      bloqueado.current=false;setPendente(false)
    }
  }
  return <DialogContent theme={tema} showCloseButton={false} className="max-h-[90dvh] overflow-y-auto"
    onEscapeKeyDown={e=>{e.preventDefault();pedirFechar()}} onPointerDownOutside={e=>{e.preventDefault();pedirFechar()}}>
    <DialogHeader><DialogTitle>Registrar venda</DialogTitle><DialogDescription>{nome}. A empresa continuará na sua Carteira e o retorno agendado será mantido.</DialogDescription></DialogHeader>
    {venda.erro ? <Alert variant="danger" role="alert">{venda.erro}</Alert> : null}
    {descarte ? <div className="space-y-3" role="alert"><h3>Descartar alterações?</h3><p>As informações não salvas serão perdidas.</p><div className="flex flex-wrap gap-2"><Button onClick={()=>setDescarte(null)}>Continuar editando</Button><Button variant="outline" onClick={descartar}>Descartar</Button></div></div> :
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();setConfirmado(true)}}>
        <fieldset disabled={pendente||confirmado} className="space-y-3">
          <label className="block space-y-1">Valor em reais<Input name="valor" inputMode="decimal" required value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" /></label>
          <label className="block space-y-1">Data da venda<Input name="data" type="date" required value={data} onChange={e=>setData(e.target.value)} /></label>
          <label className="block space-y-1">Observação (opcional)<Textarea value={nota} onChange={e=>setNota(e.target.value)} maxLength={2000} /></label>
        </fieldset>
        <p className="text-sm text-muted-foreground">Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
        {confirmado ? <div className="space-y-3"><p>Confirmar venda de R$ {valor} em {data.split('-').reverse().join('/')}?</p><div className="flex flex-wrap gap-2"><Button type="button" disabled={pendente} onClick={()=>void salvar()}>{pendente?'Registrando...':'Confirmar venda'}</Button>{!venda.comando&&<Button type="button" variant="outline" disabled={pendente} onClick={()=>setConfirmado(false)}>Corrigir dados</Button>}</div></div> : <Button type="submit">Conferir venda</Button>}
        <Button type="button" variant="ghost" disabled={pendente} onClick={pedirFechar}>{venda.comando?'Fechar mantendo envio':'Cancelar'}</Button>
      </form>}
  </DialogContent>
}
