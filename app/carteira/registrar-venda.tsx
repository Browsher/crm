'use client'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert } from '@/src/components/ui/alert'
import { Dialog, DialogContent, DialogTrigger } from '@/src/components/ui/dialog'
import { ConfirmacaoPainelCrm } from '@/src/components/crm/confirmacao-painel'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { useTemaCrm } from '@/src/components/crm/tema'
import { transmitirVenda } from '../venda-envio'
import { criarComandoVenda, type EstadoVenda } from '@/src/lib/venda-envio'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'

type PropsVenda = {usuarioId:string;empresaId:string;nome:string;disabled?:boolean}
export function RegistrarVenda(props:PropsVenda) {return <VendaUsuario key={props.usuarioId+':'+props.empresaId} {...props}/>}
function VendaUsuario({usuarioId,empresaId,nome,disabled=false}:PropsVenda) {
  const [aberto,setAberto]=useState(false),[mensagem,setMensagem]=useState('')
  const venda=useEnvioVenda(usuarioId,transmitirVenda)
  const router=useRouter(),vivo=useRef(true),botaoRecuperar=useRef<HTMLButtonElement>(null)
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
    {venda.comando&&<section aria-label="Venda pendente"><p>Venda de R$ {venda.comando.entrada.valor} em {venda.comando.entrada.data.split('-').reverse().join('/')}. Os dados do envio anterior foram preservados.</p><Button ref={botaoRecuperar} disabled={venda.pendente} variant="outline" onClick={()=>void recuperar()}>{venda.pendente?'Confirmando venda...':'Confirmar venda anterior'}</Button></section>}
    <Dialog open={aberto} onOpenChange={valor=>{if(valor&&venda.iniciarNovo()){setMensagem('');setAberto(true)}}}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled||venda.bloqueada||venda.pendente}>Registrar venda</Button></DialogTrigger>
      {aberto?<FormularioVenda usuarioId={usuarioId} empresaId={empresaId} nome={nome} venda={venda} fechar={()=>setAberto(false)} aoConfirmar={confirmar}
        aoRestaurarFoco={evento=>{
          if(!botaoRecuperar.current||botaoRecuperar.current.disabled)return
          evento.preventDefault()
          botaoRecuperar.current.focus({preventScroll:true})
        }}/>:null}
    </Dialog>
  </div>
}

function FormularioVenda({usuarioId,empresaId,nome,venda,fechar,aoConfirmar,aoRestaurarFoco}:{
  usuarioId:string;empresaId:string;nome:string;venda:ReturnType<typeof useEnvioVenda>;fechar:()=>void
  aoConfirmar:(r:Extract<EstadoVenda,{ok:true}>)=>void;aoRestaurarFoco:(evento:Event)=>void
}) {
  const tema=useTemaCrm()
  const formId=useId()
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<'fechar'|'voltar'|null>(null)
  const [pendente,setPendente]=useState(false)
  const confirmacao=descarte ? 'descarte' : confirmado ? 'venda' : null
  const conferir=useRef<HTMLButtonElement>(null),acaoNeutra=useRef<HTMLButtonElement>(null),focoAnterior=useRef<HTMLElement|null>(null)
  const bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const removendoSentinela=useRef(false),depoisDeRemover=useRef<(()=>void)|null>(null),finalizando=useRef(false)
  const sujo=!venda.resultado?.ok&&!!(valor||data||nota),sujoRef=useRef(sujo)
  const envioPreservado=useRef(!!venda.comando)
  useEffect(()=>{sujoRef.current=sujo;envioPreservado.current=!!venda.comando},[sujo,venda.comando])
  useLayoutEffect(()=>{if(confirmacao)acaoNeutra.current?.focus({preventScroll:true})},[confirmacao])
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
      if(!bloqueado.current&&!envioPreservado.current){
        guardarFoco()
        setDescarte('voltar')
      }
    }
    window.addEventListener('beforeunload',unload);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((sujo||pendente)&&!sentinela.current&&!removendoSentinela.current&&!finalizando.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__vendaCarteira:s},'',location.href)}
  },[sujo,pendente])
  function guardarFoco(){
    const alvo=document.activeElement
    if(alvo instanceof HTMLElement&&alvo.closest('[data-painel-lateral]'))focoAnterior.current=alvo
  }
  function concluir(depois?:()=>void){
    if(finalizando.current)return
    finalizando.current=true
    const continuar=()=>{if(vivo.current){fechar();depois?.()}}
    if(removendoSentinela.current){depoisDeRemover.current=continuar;return}
    if(!sentinela.current){continuar();return}
    sentinela.current=null;removendoSentinela.current=true;depoisDeRemover.current=continuar;history.back()
  }
  function pedirFechar(){
    if(bloqueado.current||finalizando.current)return
    if(!venda.comando&&sujo){guardarFoco();setDescarte('fechar');return}
    concluir()
  }
  function descartar(){
    if(bloqueado.current||finalizando.current||venda.comando)return
    if(descarte==='voltar'){
      finalizando.current=true
      sentinela.current=null
      history.go(-2)
      fechar()
    }else concluir()
  }
  function cancelarConfirmacao(){
    if(bloqueado.current||finalizando.current)return
    if(descarte){setDescarte(null);return}
    if(venda.comando){concluir();return}
    setConfirmado(false)
  }
  async function salvar(){
    if(bloqueado.current||finalizando.current||venda.resultado?.ok||!confirmado)return
    bloqueado.current=true;setPendente(true)
    const comando=venda.comando?undefined:criarComandoVenda(usuarioId,empresaId,{tipo:'recompra'},{valor,data,observacao:nota})
    const r=await venda.enviar(comando)
    if(vivo.current){
      if(r?.ok)concluir(()=>aoConfirmar(r))
      bloqueado.current=false;setPendente(false)
    }
  }
  const alerta=venda.erro ? <Alert variant="danger" role="alert">{venda.erro}</Alert> : null
  return <>
    <PainelSobrepostoCrm titulo="Registrar venda" descricao={`${nome}. A empresa continuará na sua Carteira e o retorno agendado será mantido.`}
      aoFechar={pedirFechar} onCloseAutoFocus={aoRestaurarFoco} fecharBloqueado={pendente||!!confirmacao} ocupado={pendente} rodape={<>
        <Button type="button" variant="outline" disabled={pendente||!!confirmacao} onClick={pedirFechar}>Cancelar</Button>
        <Button ref={conferir} type="submit" form={formId} disabled={pendente||!!confirmacao}>Conferir venda</Button>
      </>}>
      {!confirmacao&&alerta}
      <form id={formId} className="space-y-4" onSubmit={e=>{
        e.preventDefault()
        if(bloqueado.current||finalizando.current||confirmacao)return
        focoAnterior.current=conferir.current
        guardarFoco()
        setConfirmado(true)
      }}>
        <fieldset disabled={pendente||!!confirmacao} className="space-y-3">
          <label className="block space-y-1">Valor em reais<Input name="valor" inputMode="decimal" required value={valor} onChange={e=>setValor(e.target.value)} placeholder="0,00" /></label>
          <label className="block space-y-1">Data da venda<Input name="data" type="date" required value={data} onChange={e=>setData(e.target.value)} /></label>
          <label className="block space-y-1">Observação (opcional)<Textarea value={nota} onChange={e=>setNota(e.target.value)} maxLength={2000} /></label>
        </fieldset>
        <p className="text-sm text-muted-foreground">Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
      </form>
    </PainelSobrepostoCrm>
    <Dialog open={!!confirmacao} onOpenChange={aberta=>{if(!aberta)cancelarConfirmacao()}}>
      <DialogContent theme={tema} showCloseButton={false} aria-busy={pendente}
        onOpenAutoFocus={evento=>{evento.preventDefault();acaoNeutra.current?.focus({preventScroll:true})}}
        onCloseAutoFocus={evento=>{
          evento.preventDefault()
          if(!finalizando.current)(focoAnterior.current??conferir.current)?.focus({preventScroll:true})
        }}>
        {descarte ? <ConfirmacaoPainelCrm titulo="Descartar alterações?" alvo={<strong>{nome}</strong>}
          descricao="As informações não salvas serão perdidas." acoes={<>
            <Button ref={acaoNeutra} type="button" variant="outline" onClick={cancelarConfirmacao}>Continuar editando</Button>
            <Button type="button" onClick={descartar}>Descartar</Button>
          </>} /> : <ConfirmacaoPainelCrm titulo="Confirmar venda" alvo={<strong>{nome}</strong>}
          descricao={`Confirmar venda de R$ ${valor} em ${data.split('-').reverse().join('/')}?`} acoes={<>
            <Button ref={acaoNeutra} type="button" variant="outline" aria-disabled={pendente} className="aria-disabled:opacity-50" onClick={cancelarConfirmacao}>
              {venda.comando?'Fechar mantendo envio':'Corrigir dados'}
            </Button>
            <Button type="button" aria-disabled={pendente} className="aria-disabled:opacity-50" onClick={()=>void salvar()}>{pendente?'Registrando...':'Confirmar venda'}</Button>
          </>}>{alerta}</ConfirmacaoPainelCrm>}
      </DialogContent>
    </Dialog>
  </>
}
