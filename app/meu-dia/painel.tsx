'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { DadosEmpresaPainel } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import { pedirSaidaDaEdicao, useDescarteEdicao } from '@/src/components/crm/descarte-edicao'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'
import { transmitirVenda } from '../venda-envio'
import { PainelNegociacao, type PedirFecharNegociacao } from '../funil/modal'
import { ConfirmarArquivamento } from '../funil/arquivo-lateral'
import { useEnvioArquivo } from '../funil/use-envio-arquivo'
import { urlMeuDia, type FiltrosMeuDia } from './agenda'
import { RetornoPainel, type AbaRetorno } from './retorno-painel'
import styles from './meu-dia.module.css'

export type LinhaMeuDia = EmpresaComigo & { situacaoRetorno: 'atrasado' | 'hoje' | 'futuro' }
type Retorno = { tipo: 'retorno'; empresaId: string; aba: AbaRetorno }
type Contexto = { painel: Retorno | null; gatilho: HTMLElement }
type Painel = Retorno
  | { tipo: 'dados'; empresaId: string; anterior: Contexto }
  | { tipo: 'negociacao'; empresaId: string; negociacaoId: string; anterior: Contexto }
  | null
type Props = { usuarioId: string; linhas: LinhaMeuDia[]; agenda: LinhaMeuDia[]; filtros: FiltrosMeuDia }
const ROTULO_RETORNO = { atrasado: 'Atrasado', hoje: 'Hoje', futuro: 'Próximo' }

export function PainelMeuDia(props: Props) {
  return <PainelDoUsuario key={props.usuarioId} {...props} />
}

function PainelDoUsuario({ usuarioId, linhas, agenda, filtros }: Props) {
  const router = useRouter()
  const arquivo = useEnvioArquivo(usuarioId)
  const venda = useEnvioVenda(usuarioId, transmitirVenda)
  const [painel, setPainel] = useState<Painel>(null)
  const [removidos, setRemovidos] = useState<ReadonlySet<string>>(() => new Set())
  const [aviso, setAviso] = useState('')
  const [avisoParaId, setAvisoParaId] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState<NegociacaoResumo | null>(null)
  const [filtroAnterior, setFiltroAnterior] = useState(JSON.stringify(filtros))
  const fecharNegociacao = useRef<PedirFecharNegociacao | null>(null)
  const origem = useRef<HTMLElement | null>(null)
  const focoConfirmacao = useRef<HTMLElement | null>(null)
  const alerta = useRef<HTMLDivElement>(null)
  const contagem = useRef<HTMLParagraphElement>(null)
  const identidade = useRef<object | null>(null)
  const vivo = useRef(true)
  const operando = useRef(false)
  const linhasEfetivas = linhas.filter(linha => !removidos.has(linha.id))
  const agendaEfetiva = agenda.filter(linha => !removidos.has(linha.id))
  const atual = painel ? linhasEfetivas.find(linha => linha.id === painel.empresaId) : undefined
  const avisoAtivo = avisoParaId !== null && linhas.some(linha => linha.id === avisoParaId)

  // A ausência é persistida no estado: uma prop posterior que recoloque o id
  // não reabre a seleção. Filtros são submetidos somente após a guarda do editor.
  if (filtroAnterior !== JSON.stringify(filtros)) {
    setFiltroAnterior(JSON.stringify(filtros))
    setPainel(null)
  } else if (painel && !atual) setPainel(null)

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false; identidade.current = null }
  }, [])
  useEffect(() => { if (avisoAtivo) alerta.current?.focus() }, [avisoAtivo])
  useDescarteEdicao(false, arquivo.pendente || venda.pendente && painel?.tipo !== 'negociacao')

  const remover = useCallback((id: string) => {
    setRemovidos(anteriores => new Set(anteriores).add(id))
    setAvisoParaId(id)
    setPainel(null)
    identidade.current = null
  }, [])

  function focar(alvo: HTMLElement | null) {
    requestAnimationFrame(() => {
      const conectado = alvo?.isConnected ? alvo : alvo?.id ? document.getElementById(alvo.id) : null
      if (conectado) conectado.focus()
      else contagem.current?.focus()
    })
  }
  function fechar() { identidade.current = null; setPainel(null); focar(origem.current) }
  function trocar(proximo: NonNullable<Painel>, gatilho: HTMLElement) {
    if (arquivo.pendente || venda.pendente || confirmacao || operando.current) return
    const abrir = () => {
      identidade.current = {}
      origem.current = gatilho
      setAvisoParaId(null)
      setPainel(proximo)
    }
    if (painel?.tipo === 'negociacao' && fecharNegociacao.current) fecharNegociacao.current(abrir)
    else abrir()
  }
  function voltar(anterior: Contexto) {
    identidade.current = {}
    setPainel(anterior.painel)
    focar(anterior.gatilho)
  }
  async function recuperarVenda() {
    if (operando.current || arquivo.pendente || venda.pendente) return
    operando.current = true
    setAviso('')
    const pedido = identidade.current
    const empresaDaVenda = venda.comando?.empresaId
    try {
      const resultado = await venda.enviar()
      if (!vivo.current || !resultado) return
      if (resultado.ok) {
        setAviso(resultado.aviso ?? 'Venda anterior confirmada.')
        if (identidade.current === pedido && painel?.empresaId === empresaDaVenda) fechar()
        router.refresh()
      }
    } finally { operando.current = false }
  }
  async function arquivar(linha?: NegociacaoResumo) {
    if (operando.current || venda.pendente || arquivo.pendente) return
    operando.current = true
    setAviso('')
    const alvo = linha ?? arquivo.comando?.linha
    if (!alvo) { operando.current = false; return }
    const pedido = identidade.current
    setConfirmacao(null)
    try {
      const resultado = await (linha ? arquivo.enviar(linha) : arquivo.recuperar())
      if (!vivo.current || !resultado) return
      if (!resultado.ok) { setAviso(resultado.erro ?? 'Não foi possível confirmar o arquivamento.'); return }
      if (resultado.atual === true) {
        setRemovidos(anteriores => new Set(anteriores).add(alvo.empresaId))
        if (identidade.current === pedido && painel?.empresaId === alvo.empresaId) fechar()
      }
      setAviso(resultado.repetida ? 'Arquivamento anterior confirmado.' : 'Empresa marcada como Sem interesse.')
      router.refresh()
    } finally { operando.current = false }
  }

  const semFiltro = filtros.nome === '' && filtros.retorno === ''
  const recuperacao = <section className={styles.recuperacao} aria-label="Envios anteriores">
    {venda.comando && <Button variant="outline" disabled={venda.pendente || arquivo.pendente} onClick={() => pedirSaidaDaEdicao(() => void recuperarVenda())}>Confirmar venda anterior</Button>}
    {arquivo.comando && <Button variant="outline" disabled={arquivo.pendente || venda.pendente} onClick={() => pedirSaidaDaEdicao(() => void arquivar())}>Confirmar arquivamento anterior</Button>}
    {(aviso || arquivo.aviso || venda.erro) && <p role="status">{aviso || arquivo.aviso || venda.erro}</p>}
  </section>
  return <>
    {recuperacao}
    {avisoAtivo && <div role="alert" tabIndex={-1} ref={alerta} className={styles.vazio}>
      <h2>Esta empresa não está mais na sua agenda</h2>
      <p>O vínculo ou a tarefa mudou desde que a agenda foi carregada.</p>
      <Link href={urlMeuDia(filtros)}>Recarregar a agenda</Link>
    </div>}
    {(linhasEfetivas.length > 0 || !semFiltro) && <p ref={contagem} tabIndex={-1} className={styles.contagem}>{linhasEfetivas.length} de {agendaEfetiva.length} {agendaEfetiva.length === 1 ? 'retorno' : 'retornos'}</p>}
    {linhasEfetivas.length === 0 ? semFiltro ? <>
      <EstadoVazio titulo="Nenhum retorno pendente" descricao="Não há retornos atrasados, de hoje ou próximos." acao={{ rotulo: 'Ir para Prospecção', href: '/fila' }} />
      <Button asChild variant="outline"><Link href="/carteira">Ver carteira completa</Link></Button>
    </> : <EstadoVazio titulo="Nenhuma empresa corresponde à busca" descricao="Altere os campos ou limpe os filtros para ver a agenda." acao={{ rotulo: 'Limpar filtros', href: '/meu-dia' }} />
      : <div className={styles.corpo} data-painel-aberto={!!painel}>
        <ul className={styles.colunaLista} data-testid="lista-meu-dia">
          {linhasEfetivas.map(empresa => <li key={empresa.id} className={styles.item} data-retorno={empresa.situacaoRetorno} data-selecionada={painel?.empresaId === empresa.id}>
            <div className={styles.identidade}><div><strong title={nomeEmpresa(empresa)}>{nomeEmpresa(empresa)}</strong><small>{empresa.endereco ? empresa.endereco.localidade + '/' + empresa.endereco.uf : empresa.empresa?.cidade ?? 'Localização não informada'}</small></div>
              <span className={styles.itemEstado}>{ROTULO_RETORNO[empresa.situacaoRetorno]}</span></div>
            <div className={styles.tarefa}><p title={empresa.proximoPasso ?? undefined}>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</p>{empresa.proximoPassoData && <time dateTime={empresa.proximoPassoData}>{empresa.proximoPassoData.split('-').reverse().join('/')}</time>}</div>
            <div className={styles.acoesCard}>
              <Button variant="outline" onClick={evento => trocar({ tipo: 'dados', empresaId: empresa.id, anterior: { painel: null, gatilho: evento.currentTarget } }, evento.currentTarget)}>Dados da empresa</Button>
              <Button variant="outline" onClick={evento => trocar({ tipo: 'retorno', empresaId: empresa.id, aba: 'passo' }, evento.currentTarget)}>Abrir retorno</Button>
            </div>
          </li>)}
        </ul>
        {painel && atual && <div className={styles.colunaPerfil}>
          {painel.tipo === 'retorno' && <RetornoPainel key={atual.id} empresa={atual} filtros={filtros} aba={painel.aba} aoMudarAba={aba => setPainel({ ...painel, aba })}
            aoFechar={fechar} aoRemover={remover}
            aoDados={gatilho => trocar({ tipo: 'dados', empresaId: atual.id, anterior: { painel, gatilho } }, origem.current ?? gatilho)}
            aoNegociacao={gatilho => { if (atual.empresa?.negociacaoId) trocar({ tipo: 'negociacao', empresaId: atual.id, negociacaoId: atual.empresa.negociacaoId, anterior: { painel, gatilho } }, origem.current ?? gatilho) }} />}
          {painel.tipo === 'dados' && <DadosEmpresaPainel referencia={{ tipo: 'cadastro', empresaId: atual.id }} rotuloFechar={painel.anterior.painel ? 'Voltar' : 'Fechar'} aoFechar={() => voltar(painel.anterior)} />}
          {painel.tipo === 'negociacao' && <PainelNegociacao key={painel.negociacaoId} id={painel.negociacaoId} usuarioId={usuarioId} fecharRef={fecharNegociacao}
            rotuloFechar="Voltar" bloqueada={!!arquivo.comando || arquivo.pendente || venda.pendente || !!confirmacao}
            fechar={(texto, resultadoVenda) => {
              if (texto) { setAviso(texto); fechar(); router.refresh() }
              else if (resultadoVenda) { fechar(); router.refresh() }
              else voltar(painel.anterior)
            }}
            aoPedirArquivar={detalhe => {
              focoConfirmacao.current = document.activeElement as HTMLElement | null
              setConfirmacao(detalhe)
            }} />}
        </div>}
      </div>}
    {!painel && linhasEfetivas.length > 0 && <p className={styles.contagem}>Nenhum retorno selecionado</p>}
    {confirmacao && <ConfirmarArquivamento nome={confirmacao.nome} aoCancelar={() => setConfirmacao(null)} aoConfirmar={() => void arquivar(confirmacao)}
      aoRestaurarFoco={() => focar(focoConfirmacao.current)} />}
  </>
}
