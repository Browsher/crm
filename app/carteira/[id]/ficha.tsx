'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent } from '@/src/components/ui/dialog'
import { ConfirmacaoPainelCrm } from '@/src/components/crm/confirmacao-painel'
import { ContextoResultadoBusca } from '@/src/components/crm/contexto-resultado-busca'
import { DadosCadastrais } from '@/src/components/crm/dados-cadastrais'
import type { GrupoEmpresa } from '@/src/components/crm/empresa-detalhes'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { MenuPainelCrm } from '@/src/components/crm/menu-painel'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { useTemaCrm } from '@/src/components/crm/tema'
import { FormularioContato } from '@/src/features/contato/formulario'
import type { Contato } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { contatoPendente, descartarRascunhoContato, rascunhoAlterado, rascunhoInicial } from '@/src/features/contato/rascunho'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import type { FiltroHistoricoComercial } from '@/src/lib/historico-comercial'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'
import { criarComandoVenda, type EntradaVenda, type EstadoVenda } from '@/src/lib/venda-envio'
import type { DadosCadastrais as DadosCadastraisLidos } from '@/src/server/cnpj-biz/dados'
import { Cartao } from '../../fila/cartao'
import { transmitirVenda } from '../../venda-envio'
import { FormularioRecompra } from '../registrar-venda'
import { DadosCliente, enderecoCliente, GRUPOS_CLIENTE } from './dados-cliente'
import { FichaLegada } from './ficha-legada'
import { useGuardaPainelEdicao, voltarParaEntradaAnterior } from '@/src/components/crm/guarda-painel-edicao'
import styles from './ficha.module.css'

type Props = {
  usuarioId: string
  empresa: EmpresaComigo
  contatos: Contato[]
  erroHistorico?: boolean
  cliente?: boolean
  interceptada?: boolean
  voltarPara?: string
  rotuloVoltar?: string
  cadastrais?: DadosCadastraisLidos | null
  vendaRegistrada?: boolean
  visita?: ReactNode
  fundo?: ReactNode
}

type Leitura = 'menu' | 'passo' | 'dados' | 'historico' | GrupoEmpresa
type Nivel = Leitura | 'atendimento' | 'venda'
const SECOES = { passo: 'Atendimento e próximo passo', dados: 'Dados da empresa', historico: 'Histórico' } as const
const ENTRADA_VAZIA: EntradaVenda = { valor: '', data: '', observacao: '' }

function ehGrupo(nivel: Nivel): nivel is GrupoEmpresa {
  return nivel === 'contato' || nivel === 'cadastro' || nivel === 'atividades'
}

function assinarContato(avisar: () => void) {
  window.addEventListener('crm-contato', avisar)
  return () => window.removeEventListener('crm-contato', avisar)
}

export function Ficha(props: Props) {
  return <ComposicaoFicha key={props.usuarioId + ':' + props.empresa.id} {...props} />
}

function ComposicaoFicha({ voltarPara = '/carteira', rotuloVoltar = 'Voltar para a carteira', visita, ...props }: Props) {
  const [ocupada, setOcupada] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [reciboLegado, setReciboLegado] = useState<string | null>(null)
  const lateralPreferida = Boolean(props.cliente || props.interceptada)
  const [visitaPronta, setVisitaPronta] = useState(!lateralPreferida)
  const [composicao, setComposicao] = useState({ lateral: lateralPreferida, fundo: props.fundo })
  // Uma revalidação pode mudar a elegibilidade enquanto um editor está
  // aberto. Troque a composição assim que ele liberar a ficha.
  const lateral = ocupada ? composicao.lateral : lateralPreferida
  const fundo = props.fundo ?? composicao.fundo
  if (lateral !== composicao.lateral || fundo !== composicao.fundo) setComposicao({ lateral, fundo })
  if (!ocupada && reciboLegado !== null) {
    if (lateral) setMensagem(reciboLegado)
    setReciboLegado(null)
  }
  return <>
    {lateral ? <>
      {fundo}
      <FichaCliente {...props} voltarPara={voltarPara} rotuloVoltar={rotuloVoltar} aoMudarOcupacao={setOcupada}
        mensagem={mensagem} aoMudarMensagem={setMensagem} aoPrepararVisita={setVisitaPronta} />
    </> : <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6 max-[520px]:p-4">
      <nav aria-label="Navegação da ficha"><Button asChild variant="outline"><Link href={voltarPara}>{rotuloVoltar}</Link></Button></nav>
      {props.vendaRegistrada && <p role="status">Venda registrada. Confira o histórico deste cliente.</p>}
      {mensagem && <p role="status">{mensagem}</p>}
      <FichaLegada {...props} voltarPara={voltarPara} dadosCadastrais={<DadosCadastrais dados={props.cadastrais ?? null} />}
        aoMudarOcupacao={setOcupada} aoConfirmarAtendimento={setReciboLegado} />
    </main>}
    {visitaPronta && visita}
  </>
}

function FichaCliente({ usuarioId, empresa, contatos, erroHistorico, cliente, interceptada, voltarPara, rotuloVoltar, cadastrais, vendaRegistrada, aoMudarOcupacao, mensagem, aoMudarMensagem, aoPrepararVisita }: Props & {
  voltarPara: string
  rotuloVoltar: string
  aoMudarOcupacao: (ocupada: boolean) => void
  mensagem: string
  aoMudarMensagem: (mensagem: string) => void
  aoPrepararVisita: (pronta: boolean) => void
}) {
  const router = useRouter()
  const tema = useTemaCrm()
  const nome = nomeEmpresa(empresa)
  const prefixo = useId()
  const formVendaId = prefixo + '-recompra'
  const [nivel, setNivel] = useState<Nivel>('menu')
  const [origemTarefa, setOrigemTarefa] = useState<Leitura>('menu')
  const [origemDados, setOrigemDados] = useState<'menu' | 'passo'>('menu')
  const [filtro, setFiltro] = useState<FiltroHistoricoComercial>('todos')
  const [destinoAcoes, setDestinoAcoes] = useState<HTMLDivElement | null>(null)
  const [erroDescarte, setErroDescarte] = useState('')
  const [gatilhoLista] = useState(() => {
    if (!interceptada || typeof document === 'undefined') return null
    const alvo = document.activeElement
    return alvo instanceof HTMLElement && alvo.matches('a[href], button') && !alvo.closest('[data-painel-lateral]') ? alvo : null
  })
  const tituloSecao = useRef<HTMLHeadingElement>(null)
  const proximoFoco = useRef<string | null>(null)
  const editor = useRef<HTMLElement>(null)
  const neutro = useRef<HTMLButtonElement>(null)
  const conferirVenda = useRef<HTMLButtonElement>(null)
  const focoConfirmacao = useRef<HTMLElement | null>(null)
  const aguardarConfirmacao = useRef(false)
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])

  const arquivada = empresa.situacao === 'sem_interesse'
  const podeVender = cliente && !arquivada
  const tarefa = nivel === 'atendimento' || nivel === 'venda'
  const [rascunho, setRascunho] = useState(() => rascunhoInicial(true))
  const [baseline, setBaseline] = useState(() => rascunhoInicial(true))
  const envioContato = useSyncExternalStore(assinarContato, () => contatoPendente(empresa.id), () => false)
  const contatoAlterado = nivel === 'atendimento' && (envioContato || rascunhoAlterado(rascunho, baseline))
  const [enviandoContato, setEnviandoContato] = useState(false)
  const contatoEmVoo = useRef(false)
  function mudarPendenteContato(valor: boolean) {
    contatoEmVoo.current = valor
    // A trava é imediata. O estado visual acompanha a action fora da transição.
    queueMicrotask(() => { if (vivo.current) setEnviandoContato(valor) })
  }

  const venda = useEnvioVenda(usuarioId, transmitirVenda)
  const [entrada, setEntrada] = useState(ENTRADA_VAZIA)
  const [conferida, setConferida] = useState(false)
  const [enviandoVenda, setEnviandoVenda] = useState(false)
  const vendaEmVoo = useRef(false)
  const vendaPendente = venda.comando?.empresaId === empresa.id ? venda.comando : null
  const vendaAlterada = nivel === 'venda' && !venda.resultado?.ok && Boolean(vendaPendente || entrada.valor || entrada.data || entrada.observacao)
  const pendente = enviandoContato || enviandoVenda || venda.pendente
  useLayoutEffect(() => { aoMudarOcupacao(tarefa || pendente) }, [aoMudarOcupacao, tarefa, pendente])
  const bloqueada = () => contatoEmVoo.current || vendaEmVoo.current || venda.pendente
  const guarda = useGuardaPainelEdicao(contatoAlterado || vendaAlterada, pendente, bloqueada, saida => {
    setErroDescarte('')
    if (tarefa) {
      setEntrada(ENTRADA_VAZIA)
      setConferida(false)
      mudarNivel(origemTarefa, prefixo + (nivel === 'atendimento' ? '-atender' : venda.comando ? '-recuperar' : '-vender'))
    }
    if (saida === 'ficha') {
      if (interceptada) router.back()
      else {
        const aoRestaurar = new URL(voltarPara, location.href).pathname === '/meu-dia' ? () => router.refresh() : undefined
        if (!voltarParaEntradaAnterior(voltarPara, aoRestaurar)) router.replace(voltarPara)
      }
    }
    if (saida === 'navegador') router.back()
    if (typeof saida === 'function') saida()
  })
  const confirmacao = guarda.pedido ? 'descarte' : conferida ? 'venda' : null
  useLayoutEffect(() => {
    if (!guarda.restaurando) aoPrepararVisita(true)
  }, [aoPrepararVisita, guarda.restaurando])

  function mudarNivel(proximo: Nivel, foco?: string) {
    proximoFoco.current = foco ?? null
    setNivel(proximo)
  }

  useLayoutEffect(() => {
    const titulo = tituloSecao.current
    const destino = proximoFoco.current ? document.getElementById(proximoFoco.current) : null
    const alvo = destino instanceof HTMLElement && !destino.matches(':disabled') ? destino
      : nivel === 'atendimento' ? editor.current?.querySelector('textarea') ?? titulo : titulo
    const corpo = alvo?.closest<HTMLElement>('[data-painel-corpo]') ?? titulo?.closest<HTMLElement>('[data-painel-corpo]')
    if (corpo) corpo.scrollTop = 0
    if (aguardarConfirmacao.current) return
    proximoFoco.current = null
    alvo?.focus({ preventScroll: true })
  }, [nivel])
  useLayoutEffect(() => {
    if (!confirmacao) return
    aguardarConfirmacao.current = true
    neutro.current?.focus({ preventScroll: true })
  }, [confirmacao])

  function voltar() {
    if (bloqueada()) return
    if (tarefa) guarda.pedir('tarefa')
    else if (ehGrupo(nivel)) mudarNivel('dados', prefixo + '-' + nivel)
    else if (nivel === 'dados') mudarNivel(origemDados, origemDados === 'menu' ? prefixo + '-dados' : undefined)
    else if (nivel === 'menu') guarda.pedir('ficha')
    else mudarNivel('menu', prefixo + '-' + nivel)
  }

  function abrirAtendimento() {
    const inicial = rascunhoInicial(Boolean(cliente) || ['primeiro_contato', 'em_negociacao', 'proposta_enviada'].includes(empresa.situacao))
    setBaseline(inicial)
    setRascunho(inicial)
    setOrigemTarefa('passo')
    aoMudarMensagem('')
    mudarNivel('atendimento')
  }

  function abrirVenda() {
    if (!podeVender || bloqueada() || !venda.iniciarNovo()) return
    aoMudarMensagem('')
    setOrigemTarefa(tarefa ? origemTarefa : nivel)
    mudarNivel('venda')
  }

  function vendaConfirmada(resultado: Extract<EstadoVenda, { ok: true }>, primeira: boolean) {
    aoMudarMensagem(resultado.aviso ?? 'Venda registrada.')
    try {
      if (!primeira) router.refresh()
      else if (resultado.leituraDestino?.ok) {
        const href = '/carteira/' + encodeURIComponent(resultado.leituraDestino.destino.empresaId) + '?venda=registrada'
        // A interceptação também cobre navegações iniciadas numa ficha
        // direta. Nesse caso entre na rota canônica para desmontar a anterior.
        if (interceptada) router.replace(href)
        else location.replace(href)
      }
      else aoMudarMensagem('Venda registrada. Não foi possível abrir a ficha. Abra a Carteira.')
    } catch {
      aoMudarMensagem('Venda registrada. Atualize a página para conferir o histórico.')
    }
  }

  async function enviarVenda(recuperar = false) {
    if (bloqueada() || !recuperar && (!conferida || !vendaPendente && !podeVender)) return
    const anterior = recuperar ? venda.comando : vendaPendente
    const novo = anterior ? undefined : criarComandoVenda(usuarioId, empresa.id, { tipo: 'recompra' }, entrada)
    vendaEmVoo.current = true
    setEnviandoVenda(true)
    try {
      const resultado = await venda.enviar(novo)
      if (vivo.current && resultado?.ok) {
        guarda.concluir(() => vendaConfirmada(resultado, anterior?.alvo.tipo === 'primeira'))
      }
    } finally {
      vendaEmVoo.current = false
      if (vivo.current) setEnviandoVenda(false)
    }
  }

  function fecharConfirmacao() {
    if (bloqueada()) return
    if (guarda.pedido) {
      setErroDescarte('')
      if (conferida) guarda.foco.current = null
      guarda.cancelar()
    } else if (vendaPendente) guarda.concluir('tarefa')
    else setConferida(false)
  }

  function descartar(preservar = false) {
    if (bloqueada()) return
    if (nivel === 'atendimento' && !preservar && !descartarRascunhoContato(empresa.id)) {
      setErroDescarte('Confirme o envio anterior no atendimento antes de descartar. Você também pode fechar mantendo o rascunho.')
      return
    }
    guarda.confirmar()
  }

  const alertaVenda = venda.erro && <Alert variant="danger" role="alert">{venda.erro}</Alert>
  const rodape = nivel === 'atendimento' ? <div ref={setDestinoAcoes} />
    : nivel === 'venda' ? <>
      <Button type="button" variant="outline" disabled={pendente || !!confirmacao} onClick={voltar}>Cancelar</Button>
      <Button ref={conferirVenda} type="submit" form={formVendaId} disabled={pendente || !!confirmacao || !podeVender}>Conferir venda</Button>
    </> : venda.comando ? <Button id={prefixo + '-recuperar'} variant="outline" disabled={pendente} onClick={() => void enviarVenda(true)}>
      {pendente ? 'Confirmando venda...' : 'Confirmar venda anterior'}
    </Button> : podeVender ? <Button id={prefixo + '-vender'} variant="outline" disabled={pendente || venda.bloqueada} onClick={abrirVenda}>Registrar venda</Button>
      : null
  const titulo = nivel === 'menu' ? null : nivel === 'atendimento' ? 'Registrar atendimento' : nivel === 'venda' ? 'Registrar venda'
    : ehGrupo(nivel) ? GRUPOS_CLIENTE[nivel] : SECOES[nivel]

  return <>
    <Dialog open={!guarda.restaurando}>
      <PainelSobrepostoCrm titulo={nome} descricao={arquivada ? 'Sem interesse' : cliente ? 'Na sua carteira' : 'Em prospecção'}
        className={styles.lateralCliente}
        rotuloFechar={nivel === 'menu' ? 'Fechar' : 'Voltar'} aoFechar={voltar} fecharBloqueado={pendente || !!confirmacao}
        ocupado={pendente} rodape={rodape} onCloseAutoFocus={evento => {
          evento.preventDefault()
          if (gatilhoLista?.isConnected) gatilhoLista.focus({ preventScroll: true })
        }}>
        <div className={styles.secaoCliente}>
          {vendaRegistrada && <p role="status">Venda registrada. Confira o histórico deste cliente.</p>}
          {mensagem && <p role="status">{mensagem}</p>}
          {!confirmacao && alertaVenda}
          {!tarefa && venda.comando && <section aria-label="Venda pendente">
            {vendaPendente ? <p>Venda de R$ {vendaPendente.entrada.valor} em {vendaPendente.entrada.data.split('-').reverse().join('/')}. Os dados do envio anterior foram preservados.</p>
              : <p>Há uma venda anterior para confirmar nesta aba.</p>}
          </section>}
          {nivel === 'menu' ? <>
            <p>{enderecoCliente(empresa)}</p>
            <MenuPainelCrm rotulo="Seções do cliente" itens={(Object.keys(SECOES) as (keyof typeof SECOES)[]).map(id => ({
              id: prefixo + '-' + id, titulo: SECOES[id],
              aoAbrir: () => { if (id === 'dados') setOrigemDados('menu'); mudarNivel(id) },
            }))} />
            {!interceptada && <Link className="text-sm underline underline-offset-4" href={voltarPara} onClick={evento => {
              if (evento.button || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return
              evento.preventDefault()
              guarda.pedir('ficha')
            }}>{rotuloVoltar}</Link>}
          </> : <section ref={editor} aria-label={titulo ?? undefined} className={styles.secaoCliente}>
            <h3 ref={tituloSecao} tabIndex={-1}>{titulo}</h3>
            {nivel === 'passo' && <>
              <dl className={styles.dados}>
                <dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Sem próximo passo combinado.'}</dd>
                <dt>Retorno</dt><dd>{empresa.proximoPassoData
                  ? <time className={empresa.vencido ? styles.atrasado : undefined} dateTime={empresa.proximoPassoData}>{empresa.proximoPassoData.split('-').reverse().join('/')}{empresa.vencido ? ' · Atrasado' : ''}</time>
                  : 'Sem retorno agendado.'}</dd>
              </dl>
              {arquivada && <>
                <Alert><AlertTitle>Sem interesse</AlertTitle><AlertDescription>Retome o atendimento antes de registrar novo trabalho. O histórico da empresa continua disponível.</AlertDescription></Alert>
                {empresa.empresa && <ContextoResultadoBusca.Provider value={{ rodape: null, verEmpresa: () => { setOrigemDados('passo'); mudarNivel('dados') } }}>
                  <fieldset disabled={pendente} className="min-w-0 border-0 p-0"><Cartao empresa={empresa.empresa} naFichaCarteira={interceptada ? 'interceptada' : 'direta'} /></fieldset>
                </ContextoResultadoBusca.Provider>}
              </>}
              <Button id={prefixo + '-atender'} disabled={pendente || arquivada} onClick={abrirAtendimento}>Registrar atendimento</Button>
              {arquivada && envioContato && <Button variant="outline" disabled={pendente} onClick={abrirAtendimento}>Conferir atendimento anterior</Button>}
            </>}
            {nivel === 'dados' && <MenuPainelCrm rotulo="Grupos de dados da empresa" itens={(Object.keys(GRUPOS_CLIENTE) as GrupoEmpresa[]).map(id => ({
              id: prefixo + '-' + id, titulo: GRUPOS_CLIENTE[id], aoAbrir: () => mudarNivel(id),
            }))} />}
            {ehGrupo(nivel) && <DadosCliente grupo={nivel} empresa={empresa} cadastrais={cadastrais} />}
            {nivel === 'historico' && (erroHistorico
              ? <Alert variant="danger"><AlertTitle>Não foi possível carregar o histórico</AlertTitle><AlertDescription>Tente atualizar a página.</AlertDescription></Alert>
              : <LinhaDoTempo contatos={contatos} controleFiltro={{ valor: filtro, aoMudar: setFiltro }}
                conteudoVazio={contatos.length > 0 ? undefined : <EstadoVazio nivelTitulo={3} titulo="Ainda não há uma atividade registrada." descricao="Os atendimentos registrados nesta empresa aparecerão aqui." />} />)}
            {nivel === 'atendimento' && <FormularioContato empresaId={empresa.id} posse={empresa.posse} comDevolver={!cliente} voltarPara={voltarPara}
              visual="fila" rascunho={rascunho} onDraftChange={setRascunho} bloqueado={pendente} somenteLeitura={pendente}
              somenteConfirmacao={arquivada} onPendingChange={mudarPendenteContato} destinoAcoes={destinoAcoes}
              onCancel={voltar} rotuloSalvar="Salvar atendimento" onSaved={(_, resultado) => {
                guarda.concluir(() => aoMudarMensagem(resultado.aviso ?? (resultado.repetida ? 'Envio anterior confirmado. Dados atualizados.' : 'Atendimento registrado.')))
              }} />}
            {nivel === 'venda' && <>
              <p>A empresa continuará na sua Carteira e o retorno agendado será mantido.</p>
              {!podeVender && !vendaPendente && <Alert variant="warning">Esta empresa não está disponível para registrar uma venda.</Alert>}
              <FormularioRecompra id={formVendaId} entrada={entrada} bloqueado={pendente || !!confirmacao || !podeVender} aoMudar={setEntrada} aoConferir={evento => {
                evento.preventDefault()
                if (bloqueada() || confirmacao || !podeVender) return
                const alvo = document.activeElement
                focoConfirmacao.current = alvo instanceof HTMLElement && evento.currentTarget.contains(alvo) ? alvo : conferirVenda.current
                setConferida(true)
              }} />
            </>}
          </section>}
        </div>
      </PainelSobrepostoCrm>
    </Dialog>
    <Dialog open={!!confirmacao} onOpenChange={aberta => { if (!aberta) fecharConfirmacao() }}>
      <DialogContent theme={tema} showCloseButton={false} aria-busy={pendente}
        onOpenAutoFocus={evento => { evento.preventDefault(); neutro.current?.focus({ preventScroll: true }) }}
        onCloseAutoFocus={evento => {
          evento.preventDefault()
          aguardarConfirmacao.current = false
          const destino = proximoFoco.current
          const alvo = guarda.foco.current ?? focoConfirmacao.current
          proximoFoco.current = null
          guarda.foco.current = null
          focoConfirmacao.current = null
          if (!destino) {
            if (alvo?.isConnected && !alvo.matches(':disabled')) alvo.focus({ preventScroll: true })
            return
          }
          // O Dialog central libera o foco do painel após este evento.
          queueMicrotask(() => {
            if (!vivo.current) return
            const controle = document.getElementById(destino)
            const foco = controle instanceof HTMLElement && !controle.matches(':disabled') ? controle : tituloSecao.current
            foco?.focus({ preventScroll: true })
          })
        }}>
        {confirmacao === 'descarte' ? <ConfirmacaoPainelCrm titulo="Descartar alterações?" alvo={<strong>{nome}</strong>}
          descricao="As informações não salvas serão perdidas." acoes={<>
            <Button ref={neutro} variant="outline" onClick={fecharConfirmacao}>Continuar editando</Button>
            {nivel === 'atendimento' && <Button variant="outline" onClick={() => descartar(true)}>Fechar mantendo rascunho</Button>}
            {nivel === 'venda' && vendaPendente ? <Button onClick={() => descartar(true)}>Fechar mantendo envio</Button> : <Button onClick={() => descartar()}>Descartar</Button>}
          </>}>{erroDescarte && <Alert variant="danger">{erroDescarte}</Alert>}</ConfirmacaoPainelCrm>
          : <ConfirmacaoPainelCrm titulo="Confirmar venda" alvo={<strong>{nome}</strong>}
            descricao={`Confirmar venda de R$ ${entrada.valor} em ${entrada.data.split('-').reverse().join('/')}?`} acoes={<>
              <Button ref={neutro} variant="outline" aria-disabled={pendente} className="aria-disabled:opacity-50" onClick={fecharConfirmacao}>
                {vendaPendente ? 'Fechar mantendo envio' : 'Corrigir dados'}
              </Button>
              <Button aria-disabled={pendente || !podeVender && !vendaPendente} className="aria-disabled:opacity-50" onClick={() => void enviarVenda()}>
                {pendente ? 'Registrando...' : 'Confirmar venda'}
              </Button>
            </>}>{alertaVenda}</ConfirmacaoPainelCrm>}
      </DialogContent>
    </Dialog>
  </>
}
