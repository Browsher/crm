'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogHeader } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Textarea } from '@/src/components/ui/textarea'
import { Alert } from '@/src/components/ui/alert'
import { useTemaCrm } from '@/src/components/crm/tema'
import { useGuardaNavegacaoEdicao } from '@/src/components/crm/descarte-edicao'
import { FormularioContato } from '@/src/features/contato/formulario'
import { contatoPendente, descartarRascunhoContato, rascunhoAlterado, rascunhoInicial } from '@/src/features/contato/rascunho'
import type { NegociacaoDetalhe } from '@/src/features/funil/consulta'
import { proximaEtapa } from '@/src/lib/comercial'
import { ROTULOS_ETAPA } from './rotulos'
import { detalheAcao, telefoneAcao, etapaAcao, type EstadoFunil } from './acoes'
import { PainelLateralCrm } from '@/src/components/crm/painel-lateral'
import styles from './negociacao.module.css'
import { criarComandoVenda, type EstadoVenda } from '@/src/lib/venda-envio'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'
import { transmitirVenda } from '../venda-envio'

type Modo = 'resumo' | 'venda' | 'atendimento'
type PedidoDescarte = { destino: 'fechar' | 'resumo' | 'voltar'; depois?: () => void }
type ConfirmacaoVenda = Extract<EstadoVenda, { ok: true }>

export type PedirFecharNegociacao = (depois?: () => void) => void

type PainelNegociacaoProps = {
  id: string
  usuarioId: string
  fechar: (aviso?: string, venda?: ConfirmacaoVenda) => void
  fecharRef?: RefObject<PedirFecharNegociacao | null>
  aoPedirArquivar?: () => void
  aoMudarBloqueioDeArraste?: (bloqueado: boolean) => void
  bloqueada?: boolean
}

const formatarAtendimento = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function dataCurta(data: string) {
  return data.split('-').reverse().join('/')
}

export function PainelNegociacao({ id, usuarioId, fechar, fecharRef, aoPedirArquivar, aoMudarBloqueioDeArraste, bloqueada = false }: PainelNegociacaoProps) {
  const tema=useTemaCrm()
  const venda=useEnvioVenda(usuarioId,transmitirVenda)
  const [detalhe,setDetalhe]=useState<NegociacaoDetalhe|null>(null)
  const [carregando,setCarregando]=useState(true),[erro,setErro]=useState('')
  const [modo,setModo]=useState<Modo>('resumo')
  const [fechandoVenda,setFechandoVenda]=useState(false)
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<PedidoDescarte|null>(null)
  const [pendente,setPendente]=useState(false),[telefone,setTelefone]=useState<string|null>(null),[buscandoTelefone,setBuscandoTelefone]=useState(false)
  const [indisponivel,setIndisponivel]=useState(false)
  const [rascunho,setRascunho]=useState(()=>rascunhoInicial(true))
  const bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const pedidoTelefone=useRef(0)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const historicoId = useId()
  const tituloEdicao = useRef<HTMLHeadingElement>(null)
  const registrarAtendimento = useRef<HTMLButtonElement>(null)
  const registrarVenda = useRef<HTMLButtonElement>(null)
  const modoAnterior = useRef<Modo>('resumo')
  const recuperarVenda = useRef<HTMLButtonElement>(null)
  const rascunhoPreservado = useRef<HTMLTextAreaElement>(null)
  const focoVenda = useRef<HTMLElement | null>(null)
  const focoDescarte = useRef<HTMLElement | null>(null)
  const confirmacaoVendaAberta = confirmado && !descarte && !indisponivel && !fechandoVenda && (pendente || !venda.comando)
  const removendoSentinela=useRef(false),depoisDeRemover=useRef<(()=>void)|null>(null),finalizando=useRef(false)
  const removerSentinela=useCallback((depois?:()=>void)=>{
    if(removendoSentinela.current){if(depois)depoisDeRemover.current=depois;return}
    if(!sentinela.current){depois?.();return}
    sentinela.current=null;removendoSentinela.current=true;depoisDeRemover.current=depois??null
    history.back()
  },[])
  const [baseline]=useState(()=>rascunhoInicial(true))
  const dirty=!fechandoVenda&&!!(valor||data||nota||rascunhoAlterado(rascunho,baseline)||(modo==='atendimento'&&detalhe&&contatoPendente(detalhe.empresaId)))
  const dirtyRef=useRef(dirty)
  const arrasteBloqueado = modo !== 'resumo' || dirty || pendente || venda.pendente
  useLayoutEffect(() => { aoMudarBloqueioDeArraste?.(arrasteBloqueado) }, [aoMudarBloqueioDeArraste, arrasteBloqueado])
  useLayoutEffect(() => () => aoMudarBloqueioDeArraste?.(false), [aoMudarBloqueioDeArraste])
  useLayoutEffect(() => {
    const anterior = modoAnterior.current
    modoAnterior.current = modo
    if (modo !== 'resumo') tituloEdicao.current?.focus()
    else if (anterior === 'atendimento') registrarAtendimento.current?.focus({ preventScroll: true })
    else if (anterior === 'venda') registrarVenda.current?.focus({ preventScroll: true })
  }, [modo])
  useEffect(()=>{dirtyRef.current=dirty},[dirty])
  useEffect(()=>{
    let atual=true
    detalheAcao(id).then(d=>{if(atual){setDetalhe(d);if(!d)setErro('Esta negociação não está mais disponível para você.')}})
      .catch(()=>{if(atual)setErro('Não foi possível carregar. Feche e tente novamente.')}).finally(()=>{if(atual)setCarregando(false)})
    return()=>{atual=false}
  },[id])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const guardar=(e:BeforeUnloadEvent)=>{if(!finalizando.current&&(dirtyRef.current||bloqueado.current))e.preventDefault()}
    const voltar=(e:PopStateEvent)=>{
      if(removendoSentinela.current){
        removendoSentinela.current=false
        const continuar=depoisDeRemover.current;depoisDeRemover.current=null
        const rearmar=()=>{
          if((dirtyRef.current||bloqueado.current)&&!finalizando.current&&!sentinela.current){
            const nova=crypto.randomUUID();sentinela.current=nova
            history.pushState({...history.state,__funilRascunho:nova},'',location.href)
          }
        }
        // Proteção imediata, inclusive se outro Back chegar antes do frame.
        rearmar()
        // O App Router também restaura o histórico neste evento. Navegar só
        // no próximo frame, após todos os listeners, impede que o restore substitua o destino.
        requestAnimationFrame(()=>{
          if(!vivo.current)return
          continuar?.()
          rearmar()
        })
        return
      }
      const s=sentinela.current
      if(!s||e.state?.__funilRascunho===s)return
      history.pushState({...history.state,__funilRascunho:s},'',location.href)
      if (!bloqueado.current) {
        focoDescarte.current = document.activeElement as HTMLElement | null
        setDescarte(atual => atual ?? { destino: 'voltar' })
      }
    }
    window.addEventListener('beforeunload',guardar);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',guardar);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((dirty||pendente)&&!sentinela.current&&!removendoSentinela.current&&!finalizando.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__funilRascunho:s},'',location.href)}
  },[dirty,pendente])
  useEffect(()=>{
    if(!dirty&&!pendente)removerSentinela()
  },[dirty,pendente,removerSentinela])
  function concluir(aviso?: string, confirmacao?: ConfirmacaoVenda, depois?: () => void){
    if(finalizando.current)return
    finalizando.current=true;pedidoTelefone.current++
    // O Quadro limpa a query somente depois que o back da sentinela terminou.
    removerSentinela(()=>{
      if(!vivo.current)return
      const texto=aviso??(indisponivel?'Negociação indisponível. Agenda atualizada.':undefined)
      try {
        if (depois) depois()
        else if (confirmacao) fechar(texto, confirmacao)
        else fechar(texto)
      } catch {
        finalizando.current=false
        setErro(confirmacao?'Venda registrada. Não foi possível abrir a ficha. Abra a Carteira.':'Operação confirmada. Atualize a página para continuar.')
      }
    })
  }

  function voltarAoResumo() {
    pedidoTelefone.current++
    setModo('resumo')
  }

  function pedir(destino: 'fechar' | 'resumo', depois?: () => void) {
    if (bloqueado.current || venda.pendente || finalizando.current || descarte || confirmacaoVendaAberta) return
    if (venda.comando) {
      setErro('Confirme a venda anterior ou feche mantendo o envio. Os dados não podem ser descartados.')
      return
    }
    if (dirty) {
      focoDescarte.current = document.activeElement as HTMLElement | null
      setDescarte({ destino, depois })
      return
    }
    if (destino === 'fechar') {
      concluir(undefined, undefined, depois)
      return
    }
    removerSentinela(() => {
      if (dirtyRef.current) {
        focoDescarte.current = document.activeElement as HTMLElement | null
        setDescarte(atual => atual ?? { destino: 'resumo' })
      } else voltarAoResumo()
    })
  }

  useImperativeHandle(fecharRef, () => depois => pedir('fechar', depois))
  useGuardaNavegacaoEdicao(
    () => dirty || pendente || venda.pendente || bloqueado.current || removendoSentinela.current || finalizando.current,
    pendente || venda.pendente,
    depois => pedir('fechar', () => {
      // Se a saída falhar, o painel pode continuar no resumo e aceitar nova tentativa.
      dirtyRef.current = false
      voltarAoResumo()
      finalizando.current = false
      depois()
    }),
  )

  function descartar(preservar = false) {
    if (!descarte || bloqueado.current || venda.pendente) return
    if (venda.comando) {
      setErro('Confirme a venda anterior antes de descartar.')
      return
    }
    if (!preservar && modo === 'atendimento' && detalhe && !descartarRascunhoContato(detalhe.empresaId)) {
      setErro('Confirme o envio anterior no atendimento antes de descartar. Você também pode fechar mantendo o rascunho.')
      return
    }
    const { destino, depois } = descarte
    setDescarte(null)
    setValor('')
    setData('')
    setNota('')
    setConfirmado(false)
    setRascunho(rascunhoInicial(true))
    if (destino === 'voltar') {
      finalizando.current = true
      sentinela.current = null
      history.go(-2)
      return
    }
    if (destino === 'fechar') concluir(undefined, undefined, depois)
    else removerSentinela(voltarAoResumo)
  }

  function restaurarFoco(evento: Event, origem: HTMLElement | null) {
    evento.preventDefault()
    if (finalizando.current) return
    if (origem?.isConnected) origem.focus()
    else tituloEdicao.current?.focus()
  }
  function informarPendente(p:boolean){bloqueado.current=p;setPendente(p)}
  async function executar(acao:(f:FormData)=>Promise<EstadoFunil>,campos:Record<string,string>,sucesso:string) {
    if(bloqueado.current||finalizando.current)return
    informarPendente(true);setErro('')
    const f=new FormData();f.set('id',id);for(const[k,v]of Object.entries(campos))f.set(k,v)
    try {const r=await acao(f);if(!vivo.current)return;if(r.ok)concluir(sucesso);else {if(r.indisponivel)setIndisponivel(true);setErro(r.erro??'Não foi possível salvar.')}}
    catch {if(vivo.current)setErro('Não foi possível confirmar o resultado. Tente novamente com os mesmos dados.')}
    finally {if(vivo.current)informarPendente(false)}
  }
  async function salvarVenda(){
    const anterior = venda.comando
    if (bloqueado.current || finalizando.current || fechandoVenda || venda.pendente || !detalhe && !anterior) return
    const alvo = anterior?.alvo ?? { tipo: 'primeira' as const, negociacaoId: id }
    const vendaDesteFormulario = alvo.tipo === 'primeira' && alvo.negociacaoId === id && modo === 'venda'
    const novo = anterior ? undefined : criarComandoVenda(usuarioId, detalhe!.empresaId, alvo, { valor, data, observacao: nota })
    informarPendente(true)
    setErro('')
    try {
      const r = await venda.enviar(novo)
      if (!vivo.current || !r) return
      if (r.ok && alvo.tipo === 'primeira' && (vendaDesteFormulario || !dirty)) {
        setFechandoVenda(true)
        setConfirmado(false)
        concluir('Venda registrada.', r)
      } else if (!r.ok && r.indisponivel && vendaDesteFormulario) {
        setIndisponivel(true)
      }
    } finally {
      if (vivo.current) informarPendente(false)
    }
  }
  async function atender(){
    const pedido=++pedidoTelefone.current
    setModo('atendimento');setBuscandoTelefone(true);setErro('');setTelefone(null)
    try{const t=await telefoneAcao(id);if(vivo.current&&pedido===pedidoTelefone.current){setTelefone(t);if(t===null)concluir('A negociação não está mais disponível.')}}
    catch{if(vivo.current&&pedido===pedidoTelefone.current)setErro('Não foi possível carregar o telefone. Volte e tente novamente.')}
    finally{if(vivo.current&&pedido===pedidoTelefone.current)setBuscandoTelefone(false)}
  }

  const etapaSeguinte = detalhe && proximaEtapa(detalhe.etapa)
  const acoesBloqueadas = pendente || venda.pendente || dirty || detalhe?.empresa?.situacao === 'indisponivel'
  const alerta = (erro || venda.erro) && <Alert variant="danger" role="alert">{erro || venda.erro}</Alert>
  return <>
    <PainelLateralCrm
      id="painel-negociacao"
      className={styles.painel}
      rotulo="Negociação"
      titulo={indisponivel ? 'Negociação indisponível' : detalhe?.nome ?? 'Negociação'}
      descricao={!indisponivel && detalhe ? <>Etapa atual: <strong>{ROTULOS_ETAPA[detalhe.etapa]}</strong></> : undefined}
      aoFechar={() => pedir('fechar')}
      fecharBloqueado={pendente || venda.pendente || !!descarte || confirmacaoVendaAberta}
    >
      {carregando && <p role="status">Carregando negociação...</p>}
      {!descarte && !confirmacaoVendaAberta && alerta}
      {venda.comando && !pendente && <section className={styles.secao}>
        <p>Venda pendente de confirmação. Os dados do envio anterior foram preservados.</p>
        <div className={styles.acoes}>
          <Button ref={recuperarVenda} variant="outline" disabled={venda.pendente} onClick={() => void salvarVenda()}>{venda.pendente ? 'Confirmando venda...' : 'Confirmar venda anterior'}</Button>
          <Button variant="outline" disabled={venda.pendente} onClick={() => concluir()}>Fechar mantendo envio</Button>
        </div>
      </section>}
      {venda.resultado?.ok && <div>
        <p role="status">{venda.resultado.aviso ?? 'Venda registrada.'}</p>
        {!dirty && <Link href="/carteira">Abrir Carteira</Link>}
      </div>}
      {bloqueada && <Alert role="alert">Confirme o envio anterior no Funil antes de iniciar outra operação. Feche o painel para continuar a confirmação.</Alert>}
      {indisponivel && <section className={styles.secao}>
        <h3>Rascunho preservado</h3>
        <p>Não é possível gravar nesta negociação. Copie o que digitou antes de fechar.</p>
        <Textarea ref={rascunhoPreservado} aria-label="Rascunho preservado" readOnly rows={6} value={[valor && `Valor: ${valor}`, data && `Data: ${data}`, nota, rascunho.nota, rascunho.proximoPasso, rascunho.proximoPassoData].filter(Boolean).join('\n')} />
        <Button variant="outline" onClick={() => pedir('fechar')}>Fechar rascunho</Button>
      </section>}
      {detalhe && !indisponivel && <fieldset disabled={bloqueada || venda.pendente || !!venda.comando || fechandoVenda} className={styles.corpo}>
        {modo === 'resumo' ? <>
          <dl className={styles.dados}>
            <div><dt>Próximo passo</dt><dd>{detalhe.proximoPasso ?? 'Sem próximo passo combinado'}</dd></div>
            <div><dt>Retorno</dt><dd>{detalhe.retorno ? <time dateTime={detalhe.retorno}>{dataCurta(detalhe.retorno)}</time> : 'Sem retorno agendado'}</dd></div>
          </dl>
          <div className={styles.acoes}>
            <Button ref={registrarAtendimento} disabled={acoesBloqueadas} onClick={() => void atender()}>Registrar atendimento</Button>
            <Button ref={registrarVenda} variant="outline" disabled={acoesBloqueadas} onClick={() => { if (venda.iniciarNovo()) setModo('venda') }}>Registrar venda</Button>
            {etapaSeguinte && <Button variant="outline" disabled={acoesBloqueadas} onClick={() => void executar(etapaAcao, { etapa: etapaSeguinte, anterior: detalhe.etapa }, 'Etapa atualizada.')}>
              Avançar para {ROTULOS_ETAPA[etapaSeguinte]}
            </Button>}
            {aoPedirArquivar && <Button variant="ghost" disabled={acoesBloqueadas} onClick={aoPedirArquivar}>Marcar como Sem interesse</Button>}
          </div>
          <section className={styles.secao}>
            <h3>{historicoAberto ? 'Histórico de atendimentos' : 'Último atendimento'}</h3>
            {detalhe.historico.length ? <>
              <ol id={historicoId} className={styles.historico}>
                {(historicoAberto ? detalhe.historico : detalhe.historico.slice(0, 1)).map(contato => <li key={contato.id}>
                  <time dateTime={contato.em}>{formatarAtendimento.format(new Date(contato.em))}</time>
                  <p>{contato.nota ?? 'Sem anotação'}</p>
                  {contato.proximoPasso && <p>Próximo passo: {contato.proximoPasso}</p>}
                </li>)}
              </ol>
              <Button variant="outline" aria-expanded={historicoAberto} aria-controls={historicoId} onClick={() => setHistoricoAberto(aberto => !aberto)}>{historicoAberto ? 'Ver menos' : 'Ver todos'}</Button>
            </> : <p className={styles.muted}>Nenhum atendimento seu registrado.</p>}
          </section>
        </> : <>
          <Button variant="ghost" disabled={pendente} onClick={() => pedir('resumo')}>Voltar ao resumo</Button>
          {modo === 'atendimento' && <section className={styles.secao}>
            <h3 ref={tituloEdicao} tabIndex={-1}>Registrar atendimento</h3>
            {buscandoTelefone ? <p role="status">Carregando telefone...</p> : telefone !== null && <>
              <p>Telefone: <strong>{telefone || 'Não cadastrado'}</strong></p>
              <FormularioContato empresaId={detalhe.empresaId} posse visual="fila" rascunho={rascunho} onDraftChange={setRascunho} onPendingChange={informarPendente} onSaved={() => concluir('Atendimento registrado.')} />
            </>}
          </section>}
          {modo === 'venda' && <form className={styles.secao} onSubmit={evento => {
            evento.preventDefault()
            if (pendente || fechandoVenda || confirmado || venda.bloqueada) return
            focoVenda.current = document.activeElement as HTMLElement | null
            setConfirmado(true)
          }}>
            <h3 ref={tituloEdicao} tabIndex={-1}>Registrar primeira venda</h3>
            <p>A empresa sairá do Funil e ficará na sua Carteira. O retorno agendado será mantido.</p>
            <fieldset disabled={pendente || confirmado} className={styles.secao}>
              <label>Valor em reais<Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} required placeholder="0,00" /></label>
              <label>Data da venda<Input type="date" value={data} onChange={e => setData(e.target.value)} required /></label>
              <label>Observação (opcional)<Textarea value={nota} onChange={e => setNota(e.target.value)} maxLength={2000} /></label>
            </fieldset>
            <p className={styles.muted}>Nesta versão, vendas não podem ser editadas nem excluídas. Confira os dados antes de confirmar.</p>
            <Button type="submit" disabled={pendente || confirmado}>Conferir venda</Button>
          </form>}
        </>}
      </fieldset>}
    </PainelLateralCrm>

    <Dialog open={!!descarte} onOpenChange={aberto => { if (!aberto && !bloqueado.current && !venda.pendente) setDescarte(null) }}>
      <DialogContent theme={tema} showCloseButton={false} onCloseAutoFocus={evento => restaurarFoco(evento, focoDescarte.current)}>
        <DialogHeader>
          <DialogTitle>Descartar alterações?</DialogTitle>
          <DialogDescription>As informações não salvas serão perdidas.</DialogDescription>
        </DialogHeader>
        {alerta}
        <DialogFooter>
          <Button variant="outline" onClick={() => setDescarte(null)}>Continuar editando</Button>
          {modo === 'atendimento' && <Button variant="outline" onClick={() => descartar(true)}>Fechar mantendo rascunho</Button>}
          <Button onClick={() => descartar()}>Descartar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmacaoVendaAberta} onOpenChange={aberto => { if (!aberto && !bloqueado.current && !venda.pendente) setConfirmado(false) }}>
      <DialogContent theme={tema} showCloseButton={false} onCloseAutoFocus={evento => restaurarFoco(evento, recuperarVenda.current ?? rascunhoPreservado.current ?? focoVenda.current)}>
        <DialogHeader>
          <DialogTitle>Confirmar venda</DialogTitle>
          <DialogDescription>Confirmar venda de R$ {valor} em {dataCurta(data)}?</DialogDescription>
        </DialogHeader>
        {alerta}
        <DialogFooter>
          <Button variant="outline" disabled={pendente || venda.pendente} onClick={() => setConfirmado(false)}>Corrigir dados</Button>
          <Button disabled={pendente || venda.pendente} onClick={() => void salvarVenda()}>{pendente ? 'Registrando...' : 'Confirmar venda'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
