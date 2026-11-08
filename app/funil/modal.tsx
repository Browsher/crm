'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { Dialog, DialogContent } from '@/src/components/ui/dialog'
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
import { HistoricoComercial } from '@/src/components/crm/historico-comercial'
import { filtrarEventosHistorico, type FiltroHistoricoComercial, type EventoHistoricoComercial } from '@/src/lib/historico-comercial'
import { ROTULO, type TipoContato } from '@/src/features/contato/tipos'
import { ROTULOS_ETAPA } from './rotulos'
import { detalheAcao, telefoneAcao, etapaAcao, type EstadoFunil } from './acoes'
import { PainelLateralCrm } from '@/src/components/crm/painel-lateral'
import styles from './negociacao.module.css'
import { MenuPainelCrm } from '@/src/components/crm/menu-painel'
import { EstadoPainelCrm } from '@/src/components/crm/estado-painel'
import { ConfirmacaoPainelCrm } from '@/src/components/crm/confirmacao-painel'
import { criarComandoVenda, type EstadoVenda } from '@/src/lib/venda-envio'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'
import { transmitirVenda } from '../venda-envio'

type Leitura = 'menu' | 'passo' | 'historico'
type Modo = Leitura | 'venda' | 'atendimento'
type PedidoDescarte = { destino: 'fechar' | Leitura | 'voltar' | 'arquivo' | 'venda'; origem?: Leitura; depois?: () => void }
type ConfirmacaoVenda = Extract<EstadoVenda, { ok: true }>

export type PedirFecharNegociacao = (depois?: () => void) => void

type PainelNegociacaoProps = {
  id: string
  usuarioId: string
  fechar: (aviso?: string, venda?: ConfirmacaoVenda) => void
  fecharRef?: RefObject<PedirFecharNegociacao | null>
  rotuloFechar?: 'Fechar' | 'Voltar'
  aoPedirArquivar?: (detalhe: NegociacaoDetalhe) => void
  aoMudarBloqueioDeArraste?: (bloqueado: boolean) => void
  bloqueada?: boolean
}

function assinarContato(avisar: () => void) {
  window.addEventListener('crm-contato', avisar)
  return () => window.removeEventListener('crm-contato', avisar)
}
function sessaoContato(empresaId?: string) {
  if (!empresaId) return ''
  try { return sessionStorage.getItem('crm:contato:v1:' + empresaId) ?? '' }
  catch { return '!erro' }
}
function contatoAlterado(bruto: string | null) {
  if (!bruto) return false
  try {
    const dados = JSON.parse(bruto)
    return Boolean(dados.envio && !dados.envio.resolvido || dados.valor && rascunhoAlterado(dados.valor, rascunhoInicial(true)))
  } catch { return true }
}
function eventosDaNegociacao(detalhe: NegociacaoDetalhe): EventoHistoricoComercial[] {
  // Esta fonte já filtra criado_por pelo ator e pelo ciclo autorizado da negociação.
  return detalhe.historico.map(contato => ({
    id: contato.id, empresa: detalhe.empresaId,
    natureza: contato.tipo === 'nao_liguei' ? 'atividade_sem_ligacao' : 'contato',
    titulo: ROTULO[contato.tipo as TipoContato] ?? 'Atendimento',
    criadoEm: contato.em, autor: 'Você', nota: contato.nota,
    resultado: ROTULO[contato.tipo as TipoContato] ?? contato.tipo,
    proximoPasso: contato.proximoPasso ? { descricao: contato.proximoPasso, data: contato.retorno } : undefined,
  }))
}

function dataCurta(data: string) {
  return data.split('-').reverse().join('/')
}

export function PainelNegociacao({ id, usuarioId, fechar, fecharRef, aoPedirArquivar, aoMudarBloqueioDeArraste, bloqueada = false, rotuloFechar = 'Fechar' }: PainelNegociacaoProps) {
  const tema=useTemaCrm()
  const venda=useEnvioVenda(usuarioId,transmitirVenda)
  const [detalhe,setDetalhe]=useState<NegociacaoDetalhe|null>(null)
  const [carregando,setCarregando]=useState(true),[erro,setErro]=useState('')
  const [modo,setModo]=useState<Modo>('menu')
  const [origemTarefa, setOrigemTarefa] = useState<Leitura>('passo')
  const [filtro, setFiltro] = useState<FiltroHistoricoComercial>('todos')
  const [destinoAcoes, setDestinoAcoes] = useState<HTMLDivElement | null>(null)
  const [tentativaDetalhe, setTentativaDetalhe] = useState(0)
  const [erroLeitura, setErroLeitura] = useState(false)
  const [erroTelefone, setErroTelefone] = useState(false)
  const [fechandoVenda,setFechandoVenda]=useState(false)
  const [valor,setValor]=useState(''),[data,setData]=useState(''),[nota,setNota]=useState('')
  const [confirmado,setConfirmado]=useState(false),[descarte,setDescarte]=useState<PedidoDescarte|null>(null)
  const [pendente,setPendente]=useState(false),[telefone,setTelefone]=useState<string|null>(null),[buscandoTelefone,setBuscandoTelefone]=useState(false)
  const [indisponivel,setIndisponivel]=useState(false)
  const [rascunho,setRascunho]=useState(()=>rascunhoInicial(true))
  const bloqueado=useRef(false),vivo=useRef(true),sentinela=useRef<string|null>(null)
  const pedidoTelefone=useRef(0)
  const [atendimentoAberto, setAtendimentoAberto] = useState(false)
  const secaoId = useId()
  const formularioVendaId = useId()
  const gatilhoMenu = useRef<HTMLButtonElement | null>(null)
  const tituloLeitura = useRef<HTMLHeadingElement>(null)
  const sessao = useSyncExternalStore(assinarContato, () => sessaoContato(detalhe?.empresaId), () => null)
  const tituloEdicao = useRef<HTMLHeadingElement>(null)
  const registrarAtendimento = useRef<HTMLButtonElement>(null)
  const registrarVenda = useRef<HTMLButtonElement>(null)
  const modoAnterior = useRef<Modo>('menu')
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
  const dirty=!fechandoVenda&&!!(valor||data||nota||rascunhoAlterado(rascunho,baseline)||contatoAlterado(sessao))
  const dirtyRef=useRef(dirty)
  // O replay pode nascer em outro consumidor do mesmo ator, sem pendência local.
  const vendaPendenteRef = useRef(venda.pendente)
  useLayoutEffect(() => { vendaPendenteRef.current = venda.pendente }, [venda.pendente])
  const arrasteBloqueado = modo === 'atendimento' || modo === 'venda' || dirty || pendente || venda.pendente
  useLayoutEffect(() => { aoMudarBloqueioDeArraste?.(arrasteBloqueado) }, [aoMudarBloqueioDeArraste, arrasteBloqueado])
  useLayoutEffect(() => () => aoMudarBloqueioDeArraste?.(false), [aoMudarBloqueioDeArraste])
  useLayoutEffect(() => {
    const anterior = modoAnterior.current
    modoAnterior.current = modo
    if (modo === 'venda' || modo === 'atendimento') tituloEdicao.current?.focus()
    else if (modo === 'menu') gatilhoMenu.current?.focus({ preventScroll: true })
    else if (anterior === 'atendimento') registrarAtendimento.current?.focus({ preventScroll: true })
    else if (anterior === 'venda') registrarVenda.current?.focus({ preventScroll: true })
    else tituloLeitura.current?.focus({ preventScroll: true })
  }, [modo])
  useEffect(()=>{dirtyRef.current=dirty},[dirty])
  useEffect(()=>{
    let atual=true
    detalheAcao(id).then(d=>{if(atual){setDetalhe(d);if(!d)setErro('Esta negociação não está mais disponível para você.')}})
      .catch(()=>{if(atual){setErroLeitura(true);setErro('Não foi possível carregar a negociação. Tente novamente.')}}).finally(()=>{if(atual)setCarregando(false)})
    return()=>{atual=false}
  },[id,tentativaDetalhe])
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false}},[])
  useEffect(()=>{
    const guardar=(e:BeforeUnloadEvent)=>{if(!finalizando.current&&(dirtyRef.current||bloqueado.current||vendaPendenteRef.current))e.preventDefault()}
    const voltar=(e:PopStateEvent)=>{
      if(removendoSentinela.current){
        removendoSentinela.current=false
        const continuar=depoisDeRemover.current;depoisDeRemover.current=null
        const rearmar=()=>{
          if((dirtyRef.current||bloqueado.current||vendaPendenteRef.current)&&!finalizando.current&&!sentinela.current){
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
      if (!bloqueado.current && !vendaPendenteRef.current) {
        focoDescarte.current = document.activeElement as HTMLElement | null
        setDescarte(atual => atual ?? { destino: 'voltar' })
      }
    }
    window.addEventListener('beforeunload',guardar);window.addEventListener('popstate',voltar)
    return()=>{window.removeEventListener('beforeunload',guardar);window.removeEventListener('popstate',voltar)}
  },[])
  useEffect(()=>{
    if((dirty||pendente||venda.pendente)&&!sentinela.current&&!removendoSentinela.current&&!finalizando.current){const s=crypto.randomUUID();sentinela.current=s;history.pushState({...history.state,__funilRascunho:s},'',location.href)}
  },[dirty,pendente,venda.pendente])
  useEffect(()=>{
    if(!dirty&&!pendente&&!venda.pendente)removerSentinela()
  },[dirty,pendente,venda.pendente,removerSentinela])
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

  function voltarALeitura(destino: Leitura = origemTarefa) {
    pedidoTelefone.current++
    setBuscandoTelefone(false)
    setErroTelefone(false)
    setModo(destino)
  }

  function pedir(destino: 'fechar' | Leitura | 'arquivo' | 'venda', depois?: () => void) {
    if (bloqueado.current || venda.pendente || finalizando.current || descarte || confirmacaoVendaAberta) return
    if ((destino === 'venda' || destino === 'arquivo') && detalhe?.empresa?.situacao === 'indisponivel') return
    if (venda.comando) {
      setErro('Confirme a venda anterior ou feche mantendo o envio. Os dados não podem ser descartados.')
      return
    }
    const origem = modo === 'atendimento' || modo === 'venda' ? origemTarefa : modo
    if (dirty) {
      focoDescarte.current = document.activeElement as HTMLElement | null
      setDescarte({ destino, depois, origem })
      return
    }
    if (destino === 'fechar') {
      concluir(undefined, undefined, depois)
      return
    }
    removerSentinela(() => {
      if (dirtyRef.current) {
        focoDescarte.current = document.activeElement as HTMLElement | null
        setDescarte(atual => atual ?? { destino, depois, origem })
      } else if (destino === 'arquivo') depois?.()
      else if (destino === 'venda') { if (venda.iniciarNovo()) { setOrigemTarefa(origem ?? 'passo'); setModo('venda') } }
      else voltarALeitura(destino)
    })
  }

  useImperativeHandle(fecharRef, () => depois => pedir('fechar', depois))
  useGuardaNavegacaoEdicao(
    () => dirty || pendente || venda.pendente || bloqueado.current || removendoSentinela.current || finalizando.current,
    pendente || venda.pendente,
    depois => pedir('fechar', () => {
      // Se a saída falhar, o painel pode continuar no próximo passo e aceitar nova tentativa.
      dirtyRef.current = false
      voltarALeitura()
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
    if (!preservar && detalhe && !descartarRascunhoContato(detalhe.empresaId)) {
      setErro('Confirme o envio anterior no atendimento antes de descartar. Volte ao atendimento para confirmar o envio anterior.')
      return
    }
    const { destino, depois, origem } = descarte
    setDescarte(null)
    setValor('')
    setData('')
    setNota('')
    setConfirmado(false)
    if (!preservar) setRascunho(rascunhoInicial(true))
    if (destino === 'voltar') {
      finalizando.current = true
      sentinela.current = null
      history.go(-2)
      return
    }
    if (destino === 'fechar') concluir(undefined, undefined, depois)
    else removerSentinela(() => {
      if (destino === 'arquivo') depois?.()
      else if (destino === 'venda') { if (venda.iniciarNovo()) { setOrigemTarefa(origem ?? 'passo'); setModo('venda') } }
      else voltarALeitura(destino)
    })
  }

  function restaurarFoco(evento: Event, origem: HTMLElement | null) {
    evento.preventDefault()
    if (finalizando.current) return
    if (origem?.isConnected) origem.focus()
    else tituloEdicao.current?.focus()
  }
  function informarPendente(p:boolean){
    bloqueado.current=p
    // O formulário chama dentro da Action: a guarda é imediata, mas o estado
    // visual deve sair da Transition para acompanhar o envio ainda em curso.
    queueMicrotask(() => { if (vivo.current) setPendente(p) })
  }
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
    if (!anterior && detalhe?.empresa?.situacao === 'indisponivel') return
    if (bloqueado.current || finalizando.current || fechandoVenda || venda.pendente || !detalhe && !anterior) return
    const alvo = anterior?.alvo ?? { tipo: 'primeira' as const, negociacaoId: id }
    const vendaDesteFormulario = alvo.tipo === 'primeira' && alvo.negociacaoId === id && modo === 'venda'
    const novo = anterior ? undefined : criarComandoVenda(usuarioId, detalhe!.empresaId, alvo, { valor, data, observacao: nota })
    informarPendente(true)
    setErro('')
    try {
      const r = await venda.enviar(novo)
      if (!vivo.current || !r) return
      if (r.ok && alvo.tipo === 'primeira' && alvo.negociacaoId === id && (vendaDesteFormulario || !dirty)) {
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
    if (detalhe?.empresa?.situacao === 'indisponivel') return
    const pedido=++pedidoTelefone.current
    if (modo !== 'atendimento') setOrigemTarefa(modo === 'venda' ? origemTarefa : modo)
    setModo('atendimento')
    setErroTelefone(false)
    if (telefone !== null) return
    setAtendimentoAberto(true);setBuscandoTelefone(true);setErro('');setTelefone(null)
    try{const t=await telefoneAcao(id);if(vivo.current&&pedido===pedidoTelefone.current){setTelefone(t);if(t===null)concluir('A negociação não está mais disponível.')}}
    catch{if(vivo.current&&pedido===pedidoTelefone.current){setErroTelefone(true);setErro('Não foi possível carregar o telefone. Tente novamente.')}}
    finally{if(vivo.current&&pedido===pedidoTelefone.current)setBuscandoTelefone(false)}
  }

  const etapaSeguinte = detalhe && proximaEtapa(detalhe.etapa)
  const empresaIndisponivel = detalhe?.empresa?.situacao === 'indisponivel'
  const novasOperacoesBloqueadas = bloqueada || fechandoVenda || !!venda.comando || pendente || venda.pendente || empresaIndisponivel
  const acoesBloqueadas = novasOperacoesBloqueadas || dirty
  const alerta = (erro || venda.erro) && <Alert variant="danger" role="alert">{venda.erro || erro}</Alert>
  const eventos = detalhe ? eventosDaNegociacao(detalhe) : []
  const filtroVazio = modo === 'historico' && filtro !== 'todos' && filtrarEventosHistorico(eventos, filtro).length === 0
  const rodape = venda.comando ? <div className={styles.parAcoes}>
    <Button ref={recuperarVenda} variant="outline" disabled={pendente || venda.pendente} onClick={() => void salvarVenda()}>{venda.pendente ? 'Verificando...' : 'Verificar registro'}</Button>
    <Button variant="outline" disabled={pendente || venda.pendente} onClick={() => concluir()}>Fechar mantendo envio</Button>
  </div> : erroLeitura ? <Button onClick={() => { setCarregando(true); setErroLeitura(false); setErro(''); setTentativaDetalhe(t => t + 1) }}>Tentar novamente</Button>
    : modo === 'atendimento' ? <div ref={setDestinoAcoes}>{erroTelefone && <Button onClick={() => void atender()}>Tentar novamente</Button>}</div>
    : detalhe && !indisponivel && modo === 'venda' ? <div className={styles.parAcoes}>
      <Button variant="outline" disabled={novasOperacoesBloqueadas || confirmado} onClick={() => pedir(origemTarefa)}>Cancelar</Button>
      <Button type="submit" form={formularioVendaId} disabled={novasOperacoesBloqueadas || confirmado}>Conferir venda</Button>
    </div> : detalhe && !indisponivel && (modo === 'passo' || modo === 'historico') ? filtroVazio
      ? <Button onClick={() => { setFiltro('todos'); tituloLeitura.current?.focus({ preventScroll: true }) }}>Ver todos</Button>
      : <div className={styles.parAcoes}>
        <Button ref={registrarVenda} disabled={novasOperacoesBloqueadas} onClick={() => pedir('venda')}>Registrar venda</Button>
        <Button variant="outline" disabled={!aoPedirArquivar || novasOperacoesBloqueadas} onClick={() => pedir('arquivo', () => aoPedirArquivar?.(detalhe))}>Sem interesse</Button>
      </div> : null
  return <>
    <PainelLateralCrm
      id="painel-negociacao"
      className={styles.painel}
      rotulo="Negociação"
      titulo={indisponivel ? 'Negociação indisponível' : detalhe?.nome ?? 'Negociação'}
      descricao={!indisponivel && detalhe ? <>Etapa atual: <strong>{ROTULOS_ETAPA[detalhe.etapa]}</strong></> : undefined}
      rotuloFechar={modo === 'menu' ? rotuloFechar : 'Voltar'}
      aoFechar={() => { if (modo === 'menu') pedir('fechar'); else if (modo === 'atendimento' || modo === 'venda') pedir(origemTarefa); else voltarALeitura('menu') }}
      rodape={rodape}
      ocupado={carregando || buscandoTelefone || pendente || venda.pendente}
      fecharBloqueado={pendente || venda.pendente || !!descarte || confirmacaoVendaAberta}
    >
      {carregando && <EstadoPainelCrm tipo="carregando" titulo="Carregando negociação" descricao="Aguarde os dados autorizados desta negociação." />}
      {!carregando && !detalhe && <EstadoPainelCrm tipo={erroLeitura ? 'erro' : 'indisponivel'} titulo={erroLeitura ? 'Não foi possível carregar' : 'Negociação indisponível'} descricao={erro} />}
      {!descarte && !confirmacaoVendaAberta && (detalhe || venda.erro) && !erroTelefone && alerta}
      {venda.comando && <section className={styles.secao}>
        <EstadoPainelCrm tipo={venda.pendente ? 'pendente' : 'incerto'} titulo={venda.pendente ? 'Verificando registro' : 'Venda pendente de confirmação'} descricao="Os dados do envio anterior foram preservados. Verificar registro repete o mesmo envio." />
        <dl className={styles.dados}>
          <div><dt>Empresa do envio</dt><dd>{venda.comando.empresaId === detalhe?.empresaId ? detalhe.nome : venda.comando.empresaId}</dd></div>
          <div><dt>Tipo de venda</dt><dd>{venda.comando.alvo.tipo === 'primeira' ? 'Primeira venda · Negociação ' + venda.comando.alvo.negociacaoId : 'Recompra'}</dd></div>
          <div><dt>Valor</dt><dd>R$ {venda.comando.entrada.valor}</dd></div>
          <div><dt>Data efetiva</dt><dd>{dataCurta(venda.comando.entrada.data)}</dd></div>
          <div><dt>Observação</dt><dd>{venda.comando.entrada.observacao || 'Sem observação'}</dd></div>
        </dl>
      </section>}
      {venda.resultado?.ok && <div>
        <p role="status">{venda.resultado.aviso ?? 'Venda registrada.'}</p>
        {!dirty && <Link href="/carteira">Abrir Carteira</Link>}
      </div>}
      {bloqueada && <Alert role="alert">Confirme o envio anterior no Funil antes de iniciar outra operação. Feche o painel para continuar a confirmação.</Alert>}
      {indisponivel && <section className={styles.secao}>
        <EstadoPainelCrm tipo="indisponivel" titulo="Rascunho preservado" descricao="Não é possível gravar nesta negociação. Copie o que digitou antes de fechar." />
        <Textarea ref={rascunhoPreservado} aria-label="Rascunho preservado" readOnly rows={6} value={[valor && `Valor: ${valor}`, data && `Data: ${data}`, nota, rascunho.nota, rascunho.proximoPasso, rascunho.proximoPassoData].filter(Boolean).join('\n')} />
        <Button variant="outline" onClick={() => pedir('fechar')}>Fechar rascunho</Button>
      </section>}
      {detalhe && !indisponivel && <>
        <div hidden={modo !== 'menu'}><MenuPainelCrm rotulo="Seções da negociação" itens={[
          { id: secaoId + '-passo', titulo: 'Atendimento e próximo passo', aoAbrir: gatilho => { gatilhoMenu.current = gatilho; setModo('passo') } },
          { id: secaoId + '-historico', titulo: 'Histórico', aoAbrir: gatilho => { gatilhoMenu.current = gatilho; setModo('historico') } },
        ]} /></div>
        <fieldset disabled={bloqueada || venda.pendente || !!venda.comando || fechandoVenda} className={styles.corpo}>
        <section hidden={modo !== 'passo'} className={styles.secao}>
          <h3 ref={modo === 'passo' ? tituloLeitura : undefined} tabIndex={-1}>Atendimento e próximo passo</h3>
          <Button ref={registrarAtendimento} disabled={novasOperacoesBloqueadas} onClick={() => void atender()}>Registrar atendimento</Button>
          <dl className={styles.dados}>
            <div><dt>Próximo passo</dt><dd>{detalhe.proximoPasso ?? 'Sem próximo passo combinado'}</dd></div>
            <div><dt>Retorno</dt><dd>{detalhe.retorno ? <time dateTime={detalhe.retorno}>{dataCurta(detalhe.retorno)}</time> : 'Sem retorno agendado'}</dd></div>
          </dl>
          {etapaSeguinte && <Button variant="outline" disabled={acoesBloqueadas} onClick={() => void executar(etapaAcao, { etapa: etapaSeguinte, anterior: detalhe.etapa }, 'Etapa atualizada.')}>
            Avançar para {ROTULOS_ETAPA[etapaSeguinte]}
          </Button>}
        </section>
        <section hidden={modo !== 'atendimento'} className={styles.secao}>
          {atendimentoAberto && <>
          <h3 ref={modo === 'atendimento' ? tituloEdicao : undefined} tabIndex={-1}>Registrar atendimento</h3>
          {buscandoTelefone && <EstadoPainelCrm tipo="carregando" titulo="Carregando telefone" descricao="Aguarde para registrar o atendimento." />}
          {erroTelefone && <EstadoPainelCrm tipo="erro" titulo="Não foi possível carregar o telefone" descricao={erro} />}
          {telefone !== null && <>
            <p>Telefone: <strong>{telefone || 'Não cadastrado'}</strong></p>
            <FormularioContato empresaId={detalhe.empresaId} posse visual="fila" rascunho={rascunho} onDraftChange={setRascunho} onPendingChange={informarPendente}
              destinoAcoes={modo === 'atendimento' && !venda.comando ? destinoAcoes : null} bloqueado={bloqueada || venda.bloqueada || fechandoVenda}
              rotuloSalvar="Salvar atendimento" onCancel={() => pedir(origemTarefa)} onSaved={() => concluir('Atendimento registrado.')} />
          </>}
          </>}
        </section>
        <section hidden={modo !== 'historico'}>
          {modo === 'historico' && <>
            <h3 ref={tituloLeitura} tabIndex={-1}>Histórico</h3>
            <HistoricoComercial eventos={eventos} controleFiltro={{ valor: filtro, aoMudar: setFiltro }} conteudoVazio={<EstadoPainelCrm tipo="vazio" titulo="Nenhum registro neste filtro" descricao="Os registros disponíveis pertencem ao seu ciclo desta negociação." />} />
          </>}
        </section>
          {modo === 'venda' && <form id={formularioVendaId} className={styles.secao} onSubmit={evento => {
            evento.preventDefault()
            if (pendente || fechandoVenda || confirmado || venda.bloqueada || empresaIndisponivel) return
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
          </form>}
      </fieldset></>}
    </PainelLateralCrm>

    <Dialog open={!!descarte} onOpenChange={aberto => { if (!aberto && !bloqueado.current && !venda.pendente) setDescarte(null) }}>
      <DialogContent theme={tema} showCloseButton={false} onCloseAutoFocus={evento => restaurarFoco(evento, focoDescarte.current)}>
        <ConfirmacaoPainelCrm titulo="Descartar alterações?" alvo={<strong>{detalhe?.nome ?? 'Negociação'}</strong>} descricao="As informações não salvas serão perdidas." acoes={<>
          <Button variant="outline" onClick={() => setDescarte(null)}>Continuar editando</Button>
          {(atendimentoAberto || detalhe && contatoPendente(detalhe.empresaId)) && descarte?.destino !== 'arquivo' && descarte?.destino !== 'venda' && <Button variant="outline" onClick={() => descartar(true)}>Fechar mantendo rascunho</Button>}
          <Button onClick={() => descartar()}>Descartar</Button>
        </>}>{alerta}</ConfirmacaoPainelCrm>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmacaoVendaAberta} onOpenChange={aberto => { if (!aberto && !bloqueado.current && !venda.pendente) setConfirmado(false) }}>
      <DialogContent theme={tema} showCloseButton={false} onCloseAutoFocus={evento => restaurarFoco(evento, recuperarVenda.current ?? rascunhoPreservado.current ?? focoVenda.current)}>
        <ConfirmacaoPainelCrm titulo="Confirmar venda" alvo={<strong>{detalhe?.nome} · R$ {valor} · {dataCurta(data)}</strong>} descricao={<>Confirmar venda de R$ {valor} em {dataCurta(data)}? A empresa seguirá para a Carteira.</>} acoes={<>
          <Button variant="outline" disabled={pendente || venda.pendente} onClick={() => setConfirmado(false)}>Corrigir dados</Button>
          <Button disabled={pendente || venda.pendente} onClick={() => void salvarVenda()}>{pendente ? 'Registrando...' : 'Confirmar venda'}</Button>
        </>}>{alerta}</ConfirmacaoPainelCrm>
      </DialogContent>
    </Dialog>
  </>
}
