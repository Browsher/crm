'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert } from '@/src/components/ui/alert'
import { useTemaCrm } from '@/src/components/crm/tema'
import { FormularioContato } from '@/src/features/contato/formulario'
import { rascunhoInicial } from '@/src/features/contato/rascunho'
import type { NegociacaoDetalhe } from '@/src/features/funil/consulta'
import { proximaEtapa } from '@/src/lib/comercial'
import { ROTULOS_ETAPA } from './rotulos'
import { detalheAcao, telefoneAcao, etapaAcao, vendaAcao, devolverAcao, type EstadoFunil } from './acoes'
import styles from './funil.module.css'

type Modo='resumo'|'venda'|'devolver'|'atendimento'
export function ModalFunil({id,fechar}:{id:string;fechar:(aviso?:string)=>void}) {
  const tema=useTemaCrm()
  const [detalhe,setDetalhe]=useState<NegociacaoDetalhe|null>(null)
  const [carregando,setCarregando]=useState(true),[erro,setErro]=useState('')
  const [modo,setModo]=useState<Modo>('resumo')
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState(''),[motivo,setMotivo]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<'fechar'|'resumo'|'voltar'|null>(null)
  const [pendente,setPendente]=useState(false),[telefone,setTelefone]=useState<string|null>(null),[buscandoTelefone,setBuscandoTelefone]=useState(false)
  const [indisponivel,setIndisponivel]=useState(false)
  const [rascunho,setRascunho]=useState(()=>rascunhoInicial(true))
  const chave=useRef(''),bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const pedidoTelefone=useRef(0)
  const dirty=!!(valor||data||nota||motivo||rascunho.nota||rascunho.proximoPasso||rascunho.proximoPassoData||rascunho.tipo!=='acompanhamento')
  const dirtyRef=useRef(dirty)
  useEffect(()=>{dirtyRef.current=dirty},[dirty])
  useEffect(()=>{
    let atual=true
    detalheAcao(id).then(d=>{if(atual){setDetalhe(d);if(!d)setErro('Esta negociação não está mais disponível para você.')}})
      .catch(()=>{if(atual)setErro('Não foi possível carregar. Feche e tente novamente.')}).finally(()=>{if(atual)setCarregando(false)})
    return()=>{atual=false}
  },[id])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const guardar=(e:BeforeUnloadEvent)=>{if(dirtyRef.current||bloqueado.current)e.preventDefault()}
    const voltar=(e:PopStateEvent)=>{
      const s=sentinela.current
      if(!s||e.state?.__funilRascunho===s)return
      history.pushState({...history.state,__funilRascunho:s},'',location.href)
      if(!bloqueado.current)setDescarte('voltar')
    }
    window.addEventListener('beforeunload',guardar);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',guardar);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((dirty||pendente)&&!sentinela.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__funilRascunho:s},'',location.href)}
  },[dirty,pendente])
  function removerSentinela(){if(sentinela.current){sentinela.current=null;history.back()}}
  function concluir(aviso?:string){pedidoTelefone.current++;removerSentinela();fechar(aviso??(indisponivel?'Negociação indisponível. Agenda atualizada.':undefined))}
  function pedir(destino:'fechar'|'resumo') {
    if(bloqueado.current)return
    if(dirty){setDescarte(destino);return}
    if(destino==='fechar')concluir();else {pedidoTelefone.current++;setModo('resumo')}
  }
  function descartar() {
    const destino=descarte
    setDescarte(null);setValor('');setData('');setNota('');setMotivo('');setConfirmado(false);setRascunho(rascunhoInicial(true))
    if(destino==='voltar'){sentinela.current=null;history.go(-2);return}
    if(destino==='fechar')concluir();else {pedidoTelefone.current++;removerSentinela();setModo('resumo')}
  }
  function informarPendente(p:boolean){bloqueado.current=p;setPendente(p)}
  async function executar(acao:(f:FormData)=>Promise<EstadoFunil>,campos:Record<string,string>,sucesso:string) {
    if(bloqueado.current)return
    informarPendente(true);setErro('')
    const f=new FormData();f.set('id',id);for(const[k,v]of Object.entries(campos))f.set(k,v)
    try {const r=await acao(f);if(!vivo.current)return;if(r.ok)concluir(sucesso);else {if(r.indisponivel)setIndisponivel(true);setErro(r.erro??'Não foi possível salvar.')}}
    catch {if(vivo.current)setErro('Não foi possível confirmar o resultado. Tente novamente com os mesmos dados.')}
    finally {if(vivo.current)informarPendente(false)}
  }
  async function atender(){
    const pedido=++pedidoTelefone.current
    setModo('atendimento');setBuscandoTelefone(true);setErro('');setTelefone(null)
    try{const t=await telefoneAcao(id);if(vivo.current&&pedido===pedidoTelefone.current){setTelefone(t);if(t===null)concluir('A negociação não está mais disponível.')}}
    catch{if(vivo.current&&pedido===pedidoTelefone.current)setErro('Não foi possível carregar o telefone. Volte e tente novamente.')}
    finally{if(vivo.current&&pedido===pedidoTelefone.current)setBuscandoTelefone(false)}
  }
  return <Dialog open onOpenChange={aberto=>{if(!aberto)pedir('fechar')}}><DialogContent theme={tema} className={styles.modal} showCloseButton={!pendente}
    onCloseAutoFocus={e=>e.preventDefault()} onEscapeKeyDown={e=>{e.preventDefault();pedir('fechar')}} onPointerDownOutside={e=>{e.preventDefault();pedir('fechar')}}>
    <DialogHeader><DialogTitle>{indisponivel?'Negociação indisponível':detalhe?.nome??'Negociação'}</DialogTitle><DialogDescription>{!indisponivel&&detalhe?`${detalhe.cidade??'Cidade não cadastrada'}${detalhe.uf?' / '+detalhe.uf:''}`:'Dados da sua negociação'}</DialogDescription></DialogHeader>
    {carregando?<p role="status">Carregando negociação...</p>:null}
    {erro&&<Alert variant="danger" role="alert">{erro}</Alert>}
    {descarte?<div className={styles.confirmacao} role="alert"><h3>Descartar alterações?</h3><p>As informações não salvas serão perdidas.</p><div className={styles.acoes}><Button onClick={()=>setDescarte(null)}>Continuar editando</Button><Button variant="outline" onClick={descartar}>Descartar</Button></div></div>:null}
    {indisponivel&&!descarte&&<section className={styles.formulario}><h3>Rascunho preservado</h3><p>Não é possível gravar nesta negociação. Copie o que digitou antes de fechar.</p><Textarea aria-label="Rascunho preservado" readOnly rows={6} value={[valor&&`Valor: ${valor}`,data&&`Data: ${data}`,nota,motivo,rascunho.nota,rascunho.proximoPasso,rascunho.proximoPassoData].filter(Boolean).join('\n')} /><Button variant="outline" onClick={()=>pedir('fechar')}>Fechar rascunho</Button></section>}
    {detalhe&&!descarte&&!indisponivel&&<div className={styles.corpo}>
      {modo==='resumo'?<>
        <div className={styles.formulario}>
          <p>Etapa atual: <strong>{ROTULOS_ETAPA[detalhe.etapa]}</strong></p>
          {proximaEtapa(detalhe.etapa)&&<Button variant="outline" disabled={pendente} onClick={()=>void executar(etapaAcao,{etapa:proximaEtapa(detalhe.etapa)!,anterior:detalhe.etapa},'Etapa atualizada.')}>
            Avançar para {ROTULOS_ETAPA[proximaEtapa(detalhe.etapa)!]}
          </Button>}
        </div>
        <dl className={styles.dados}><div><dt>CNPJ</dt><dd>{detalhe.cnpj}</dd></div><div><dt>Próximo passo</dt><dd>{detalhe.proximoPasso??'Sem próximo passo combinado'}{detalhe.retorno&&<p>{detalhe.retorno.split('-').reverse().join('/')}</p>}</dd></div></dl>
        <div className={styles.acoes}><Button disabled={pendente||dirty} onClick={()=>void atender()}>Registrar atendimento</Button><Button variant="outline" disabled={pendente||dirty} onClick={()=>{chave.current=crypto.randomUUID();setModo('venda')}}>Registrar venda</Button><Button variant="ghost" disabled={pendente||dirty} onClick={()=>setModo('devolver')}>Devolver à prospecção</Button></div>
        <section><h3>Seus atendimentos</h3>{!detalhe.historico.length?<p className={styles.muted}>Nenhum atendimento seu registrado.</p>:<ol className={styles.historico}>{detalhe.historico.map(c=><li key={c.id}><time>{new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(c.em))}</time><p>{c.nota??'Sem anotação'}</p>{c.proximoPasso&&<p>Próximo passo: {c.proximoPasso}</p>}</li>)}</ol>}</section>
      </>:<>
        <Button variant="ghost" disabled={pendente} onClick={()=>pedir('resumo')}>Voltar ao resumo</Button>
        {modo==='atendimento'?<><h3>Registrar atendimento</h3>{buscandoTelefone?<p role="status">Carregando telefone...</p>:telefone!==null?<><p>Telefone: <strong>{telefone||'Não cadastrado'}</strong></p><FormularioContato empresaId={detalhe.empresaId} posse visual="fila" rascunho={rascunho} onDraftChange={setRascunho} onPendingChange={informarPendente} onSaved={()=>concluir('Atendimento registrado.')} /></>:null}</>:null}
        {modo==='venda'?<form className={styles.formulario} onSubmit={e=>{e.preventDefault();setConfirmado(true)}}><h3>Registrar primeira venda</h3><p>A empresa sairá do Funil e ficará na sua Carteira. O retorno agendado será mantido.</p>
          <fieldset disabled={pendente||confirmado} className={styles.formulario}><label>Valor em reais<Input inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)} required placeholder="0,00" /></label><label>Data da venda<Input type="date" value={data} onChange={e=>setData(e.target.value)} required /></label><label>Observação (opcional)<Textarea value={nota} onChange={e=>setNota(e.target.value)} maxLength={2000} /></label></fieldset>
          <p className={styles.muted}>Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
          {!confirmado?<Button type="submit">Conferir venda</Button>:<div className={styles.confirmacao}><p>Confirmar venda de R$ {valor} em {data.split('-').reverse().join('/')}?</p><div className={styles.acoes}><Button disabled={pendente} onClick={()=>void executar(vendaAcao,{valor,data,observacao:nota,chave:chave.current,confirmado:'sim'},'Venda registrada. Cliente disponível na Carteira.')} type="button">{pendente?'Registrando...':'Confirmar venda'}</Button><Button disabled={pendente} type="button" variant="outline" onClick={()=>setConfirmado(false)}>Corrigir dados</Button></div></div>}
        </form>:null}
        {modo==='devolver'?<form className={styles.formulario} onSubmit={e=>{e.preventDefault();setConfirmado(true)}}><h3>Devolver à prospecção</h3><p>A negociação será encerrada. A empresa seguirá o prazo de disponibilidade da Prospecção.</p><label>Motivo<Textarea value={motivo} onChange={e=>setMotivo(e.target.value)} required maxLength={2000} disabled={pendente||confirmado} /></label>{!confirmado?<Button type="submit" variant="outline">Conferir devolução</Button>:<div className={styles.confirmacao}><p>Confirmar a devolução desta empresa?</p><Button type="button" disabled={pendente} onClick={()=>void executar(devolverAcao,{motivo,confirmado:'sim'},'Empresa devolvida. Motivo registrado no histórico.')}>Confirmar devolução</Button><Button type="button" variant="outline" disabled={pendente} onClick={()=>setConfirmado(false)}>Continuar editando</Button></div>}</form>:null}
      </>}
    </div>}
  </DialogContent></Dialog>
}
