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

export function RegistrarVenda({empresaId,nome,disabled=false}:{empresaId:string;nome:string;disabled?:boolean}) {
  const [aberto,setAberto]=useState(false)
  return <Dialog open={aberto} onOpenChange={valor=>{if(valor)setAberto(true)}}>
    <DialogTrigger asChild><Button variant="outline" disabled={disabled}>Registrar venda</Button></DialogTrigger>
    {aberto ? <FormularioVenda empresaId={empresaId} nome={nome} fechar={()=>setAberto(false)} /> : null}
  </Dialog>
}

function FormularioVenda({empresaId,nome,fechar}:{empresaId:string;nome:string;fechar:()=>void}) {
  const tema=useTemaCrm(),router=useRouter()
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<'fechar'|'voltar'|null>(null)
  const [pendente,setPendente]=useState(false),[erro,setErro]=useState('')
  const chave=useRef(''),bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const sujo=!!(valor||data||nota),sujoRef=useRef(sujo)
  useEffect(()=>{sujoRef.current=sujo},[sujo])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(sujoRef.current||bloqueado.current)e.preventDefault()}
    const voltar=(e:PopStateEvent)=>{
      const s=sentinela.current
      if(!s||e.state?.__vendaCarteira===s)return
      history.pushState({...history.state,__vendaCarteira:s},'',location.href)
      if(!bloqueado.current)setDescarte('voltar')
    }
    window.addEventListener('beforeunload',unload);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((sujo||pendente)&&!sentinela.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__vendaCarteira:s},'',location.href)}
  },[sujo,pendente])
  function concluir(){if(sentinela.current){sentinela.current=null;history.back()}fechar()}
  function pedirFechar(){if(bloqueado.current)return;if(sujo){setDescarte('fechar');return}concluir()}
  function descartar(){if(descarte==='voltar'){sentinela.current=null;history.go(-2);fechar()}else concluir()}
  async function salvar(){
    if(bloqueado.current||!confirmado)return
    bloqueado.current=true;setPendente(true);setErro('')
    if(!chave.current)chave.current=crypto.randomUUID()
    const form=new FormData()
    for(const[k,v]of Object.entries({id:empresaId,chave:chave.current,valor,data,observacao:nota,confirmado:'sim'}))form.set(k,v)
    try{
      const r=await vendaCarteiraAcao(form)
      if(!vivo.current)return
      if(r.ok){concluir();router.refresh()}
      else setErro(r.erro??'Não foi possível registrar a venda.')
    }catch{if(vivo.current)setErro('Não foi possível confirmar o resultado. Tente novamente com os mesmos dados.')}
    finally{if(vivo.current){bloqueado.current=false;setPendente(false)}}
  }
  return <DialogContent theme={tema} showCloseButton={false} className="max-h-[90dvh] overflow-y-auto"
    onEscapeKeyDown={e=>{e.preventDefault();pedirFechar()}} onPointerDownOutside={e=>{e.preventDefault();pedirFechar()}}>
    <DialogHeader><DialogTitle>Registrar venda</DialogTitle><DialogDescription>{nome}. A empresa continuará na sua Carteira e o retorno agendado será mantido.</DialogDescription></DialogHeader>
    {erro ? <Alert variant="danger" role="alert">{erro}</Alert> : null}
    {descarte ? <div className="space-y-3" role="alert"><h3>Descartar alterações?</h3><p>As informações não salvas serão perdidas.</p><div className="flex flex-wrap gap-2"><Button onClick={()=>setDescarte(null)}>Continuar editando</Button><Button variant="outline" onClick={descartar}>Descartar</Button></div></div> :
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();setConfirmado(true)}}>
        <fieldset disabled={pendente||confirmado} className="space-y-3">
          <label className="block space-y-1">Valor em reais<Input name="valor" inputMode="decimal" required value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" /></label>
          <label className="block space-y-1">Data da venda<Input name="data" type="date" required value={data} onChange={e=>setData(e.target.value)} /></label>
          <label className="block space-y-1">Observação (opcional)<Textarea value={nota} onChange={e=>setNota(e.target.value)} maxLength={2000} /></label>
        </fieldset>
        <p className="text-sm text-muted-foreground">Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
        {confirmado ? <div className="space-y-3"><p>Confirmar venda de R$ {valor} em {data.split('-').reverse().join('/')}?</p><div className="flex flex-wrap gap-2"><Button type="button" disabled={pendente} onClick={()=>void salvar()}>{pendente?'Registrando...':'Confirmar venda'}</Button><Button type="button" variant="outline" disabled={pendente} onClick={()=>setConfirmado(false)}>Corrigir dados</Button></div></div> : <Button type="submit">Conferir venda</Button>}
        <Button type="button" variant="ghost" disabled={pendente} onClick={pedirFechar}>Cancelar</Button>
      </form>}
  </DialogContent>
}
