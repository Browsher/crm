'use client'

import { useCallback, useEffect, useRef, useState, startTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ETAPAS_FUNIL, proximaEtapa, type EtapaFunil } from '@/src/lib/comercial'
import { dataEmpresa, type ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import type { ArquivoFunilRecente } from '@/src/lib/funil-arquivo'
import type { NegociacaoResumo } from '@/src/features/funil/consulta'
import { textoDoMotivo } from '@/src/features/contato/mensagens'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { DadosEmpresaPainel } from '@/src/components/crm/empresa-dialogo'
import { Button } from '@/src/components/ui/button'
import type { EstadoVenda } from '@/src/lib/venda-envio'
import { useEnvioVenda } from '@/src/lib/use-envio-venda'
import { transmitirVenda } from '../venda-envio'
import { devolverFunilAcao, etapaAcao, semInteresseAcao } from './acoes'
import { ConfirmarArquivamento, EfeitoArquivo, IconeLixeira, ID_ARQUIVO, PainelArquivo, RecuperacaoDevolucao, type AnimacaoArquivo } from './arquivo-lateral'
import { PainelNegociacao, type PedirFecharNegociacao } from './modal'
import { ROTULOS_ETAPA } from './rotulos'
import styles from './funil.module.css'

const STORAGE_ARQUIVO = 'crm:funil:arquivo:v1'
const STORAGE_DEVOLUCAO = 'crm:funil:devolver:v1'
const SEM_ARQUIVOS: ArquivoFunilRecente[] = []

type EnvioArquivo = { linha: NegociacaoResumo; chave: string }
type EnvioDevolucao = { item: ArquivoFunilRecente; chave: string }
type Painel =
  | { tipo: 'empresa'; id: string; referencia: ReferenciaEmpresa }
  | { tipo: 'negociacao'; id: string }
  | { tipo: 'arquivo' }
  | null
type PropsQuadro = { linhas: NegociacaoResumo[]; arquivos?: ArquivoFunilRecente[]; negociacaoInicial?: string | null; usuarioId: string }

function disponivel(linha: NegociacaoResumo) {
  return linha.empresa.situacao !== 'indisponivel' && linha.empresa.negociacaoId === linha.id && linha.empresa.versao === linha.versao
}

function idCard(id: string) { return 'funil-card-' + id }
function cicloArquivo(item: ArquivoFunilRecente) { return item.negociacaoId + ':' + item.versao }

function centro(elemento: Element | null) {
  const retangulo = elemento?.getBoundingClientRect()
  return retangulo ? { x: retangulo.left + retangulo.width / 2, y: retangulo.top + retangulo.height / 2 } : null
}

function enviar<T>(acao: (form: FormData) => Promise<T>, form: FormData): Promise<T> {
  // Mostra o estado de envio imediatamente, antes de chamar a ação remota.
  return new Promise((resolve, reject) => startTransition(() => {
    try { acao(form).then(resolve, reject) }
    catch (erro) { reject(erro) }
  }))
}

export function Quadro(props: PropsQuadro) {
  return <QuadroUsuario key={props.usuarioId} {...props}/>
}

function QuadroUsuario({ linhas, arquivos = SEM_ARQUIVOS, negociacaoInicial = null, usuarioId }: PropsQuadro) {
  const router = useRouter()
  const venda = useEnvioVenda(usuarioId, transmitirVenda)
  const vendaBloqueada = venda.bloqueada || venda.pendente
  const storageArquivo = STORAGE_ARQUIVO + ':' + usuarioId
  const storageDevolucao = STORAGE_DEVOLUCAO + ':' + usuarioId

  const [painel, setPainel] = useState<Painel>(negociacaoInicial ? { tipo: 'negociacao', id: negociacaoInicial } : null)
  const [aviso, setAviso] = useState('')
  const [desktop, setDesktop] = useState(false)
  const [pendente, setPendente] = useState(false)
  const [arrasteBloqueado, setArrasteBloqueado] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [sobreLixeira, setSobreLixeira] = useState(false)
  const [destino, setDestino] = useState<EtapaFunil | null>(null)
  const [confirmacao, setConfirmacao] = useState<NegociacaoResumo | null>(null)
  const [animacao, setAnimacao] = useState<AnimacaoArquivo | null>(null)
  const [envioArquivo, setEnvioArquivo] = useState<EnvioArquivo | null>(null)
  const [envioDevolucao, setEnvioDevolucao] = useState<EnvioDevolucao | null>(null)
  const [removidas, setRemovidas] = useState<Set<string>>(() => new Set())
  const [ocultacaoArquivo, setOcultacaoArquivo] = useState<{ base: ArquivoFunilRecente[]; ciclos: Set<string> } | null>(null)
  const [movimento, setMovimento] = useState<{ base: NegociacaoResumo[]; id: string; etapa: EtapaFunil } | null>(null)

  const arraste = useRef<NegociacaoResumo | null>(null)
  const bloqueado = useRef(false)
  const vivo = useRef(true)
  const envioArquivoRef = useRef<EnvioArquivo | null>(null)
  const envioDevolucaoRef = useRef<EnvioDevolucao | null>(null)
  const fecharNegociacao = useRef<PedirFecharNegociacao | null>(null)
  const origem = useRef<HTMLElement | null>(null)
  const origemConfirmacao = useRef<HTMLElement | null>(null)
  const mensagem = useRef<HTMLParagraphElement | null>(null)
  const botaoArquivo = useRef<HTMLButtonElement | null>(null)
  const iconeArquivo = useRef<SVGSVGElement | null>(null)
  const limparAnimacao = useCallback(() => setAnimacao(null), [])

  const negociacaoAberta = painel?.tipo === 'negociacao' ? painel.id : null
  const bloqueiaAcao = pendente || !!envioArquivo || !!envioDevolucao || vendaBloqueada || !!confirmacao
  const ciclosOcultos = ocultacaoArquivo?.base === arquivos ? ocultacaoArquivo.ciclos : null
  const recentes = arquivos.slice(0, 3).filter(item => !ciclosOcultos?.has(cicloArquivo(item)))
  const visiveis = linhas.filter(linha => !removidas.has(linha.id)).map(linha =>
    movimento?.base === linhas && linha.id === movimento.id ? { ...linha, etapa: movimento.etapa } : linha)
  if (envioArquivo && !visiveis.some(linha => linha.id === envioArquivo.linha.id)) visiveis.push(envioArquivo.linha)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const atualizar = () => setDesktop(media.matches)
    atualizar()
    media.addEventListener('change', atualizar)
    return () => media.removeEventListener('change', atualizar)
  }, [])

  useEffect(() => {
    let ativo = true
    queueMicrotask(() => {
      if (!ativo) return
      try {
        const salvo = sessionStorage.getItem(storageArquivo)
        const anterior = salvo ? JSON.parse(salvo) as EnvioArquivo : null
        if (anterior?.linha?.id && anterior.chave) {
          envioArquivoRef.current = anterior
          setEnvioArquivo(anterior)
          setAviso('Confirme o envio anterior antes de iniciar outra operação.')
        }
      } catch { setAviso('Não foi possível recuperar o envio anterior. Atualize a página.') }
      try {
        const salvo = sessionStorage.getItem(storageDevolucao)
        const anterior = salvo ? JSON.parse(salvo) as EnvioDevolucao : null
        if (anterior?.item?.empresaId && anterior.item.negociacaoId && anterior.chave) {
          envioDevolucaoRef.current = anterior
          setEnvioDevolucao(anterior)
        }
      } catch { setAviso('Não foi possível recuperar a devolução anterior. Atualize a página.') }
    })
    return () => { ativo = false }
  }, [storageArquivo, storageDevolucao])

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])

  function focarMensagem() { requestAnimationFrame(() => mensagem.current?.focus()) }
  function focarOrigem(alvo: HTMLElement | null) {
    requestAnimationFrame(() => (alvo?.isConnected ? alvo : botaoArquivo.current)?.focus())
  }

  function limparSelecaoDaUrl() {
    const url = new URL(location.href)
    if (url.pathname !== '/funil' || !url.searchParams.has('negociacao')) return false
    url.searchParams.delete('negociacao')
    router.replace(url.pathname + url.search + url.hash, { scroll: false })
    return true
  }

  function selecionarPainel(proximo: NonNullable<Painel>, gatilho: HTMLElement) {
    if (bloqueado.current || confirmacao) return
    if (painel?.tipo === proximo.tipo && (proximo.tipo === 'arquivo' || ('id' in painel && painel.id === proximo.id))) return
    const trocar = () => {
      if (negociacaoAberta) limparSelecaoDaUrl()
      origem.current = gatilho
      setPainel(proximo)
    }
    if (negociacaoAberta && fecharNegociacao.current) fecharNegociacao.current(trocar)
    else trocar()
  }

  function fecharPainel(texto?: string, confirmacaoVenda?: Extract<EstadoVenda, { ok: true }>) {
    if (confirmacao && !negociacaoAberta) return
    setPainel(null)
    if (confirmacaoVenda) { abrirFicha(confirmacaoVenda); return }
    const limpou = negociacaoAberta ? limparSelecaoDaUrl() : false
    if (texto) {
      setAviso(texto)
      if (!limpou) router.refresh()
      focarMensagem()
    } else focarOrigem(origem.current)
  }

  function terminarArraste() {
    arraste.current = null
    setDestino(null)
    setArrastando(false)
    setSobreLixeira(false)
  }

  function podeArrastar(linha: NegociacaoResumo) {
    return desktop && !bloqueiaAcao && !arrasteBloqueado && disponivel(linha)
  }

  function iniciarArraste(evento: DragEvent<HTMLElement>, linha: NegociacaoResumo) {
    if (!podeArrastar(linha) || bloqueado.current || envioArquivoRef.current || envioDevolucaoRef.current) {
      evento.preventDefault()
      return
    }
    arraste.current = linha
    setArrastando(true)
    setDestino(proximaEtapa(linha.etapa))
    evento.dataTransfer.effectAllowed = 'move'
    evento.dataTransfer.setData('text/plain', linha.id)
  }

  async function soltarNaEtapa(evento: DragEvent<HTMLElement>, etapa: EtapaFunil) {
    evento.preventDefault()
    const linha = arraste.current
    terminarArraste()
    if (!linha || !podeArrastar(linha) || bloqueado.current || proximaEtapa(linha.etapa) !== etapa) return
    if (!visiveis.some(atual => atual.id === linha.id && atual.etapa === linha.etapa)) return
    bloqueado.current = true
    setPendente(true)
    setAviso('Salvando etapa...')
    setMovimento({ base: linhas, id: linha.id, etapa })
    const form = new FormData()
    form.set('id', linha.id)
    form.set('anterior', linha.etapa)
    form.set('etapa', etapa)
    try {
      const resultado = await enviar(etapaAcao, form)
      if (!vivo.current) return
      if (resultado.ok) {
        if (negociacaoAberta === linha.id) {
          setPainel(null)
          limparSelecaoDaUrl()
        }
        setAviso('Etapa atualizada para ' + ROTULOS_ETAPA[etapa] + '.')
        router.refresh()
      } else {
        setMovimento(null)
        setAviso(resultado.erro ?? 'Não foi possível avançar. Tente novamente.')
      }
    } catch {
      if (vivo.current) {
        setMovimento(null)
        setAviso('Não foi possível confirmar o avanço. Atualize o quadro antes de tentar novamente.')
      }
    } finally {
      bloqueado.current = false
      if (vivo.current) { setPendente(false); focarMensagem() }
    }
  }

  function pedirArquivamento(linha: NegociacaoResumo, gatilho: HTMLElement | null) {
    if (bloqueado.current || bloqueiaAcao || envioArquivoRef.current || envioDevolucaoRef.current || !disponivel(linha)) return
    origemConfirmacao.current = gatilho
    setConfirmacao(linha)
  }

  function soltarNaLixeira(evento: DragEvent<HTMLButtonElement>) {
    if (!arraste.current) return
    evento.preventDefault()
    const linha = arraste.current
    terminarArraste()
    if (!podeArrastar(linha)) return
    const atual = visiveis.find(item => item.id === linha.id && item.versao === linha.versao)
    if (atual) pedirArquivamento(atual, document.getElementById(idCard(linha.id)))
  }

  async function arquivar(linha: NegociacaoResumo) {
    if (bloqueado.current || vendaBloqueada || envioDevolucaoRef.current) return
    const anterior = envioArquivoRef.current
    if (anterior ? anterior.linha.id !== linha.id : !disponivel(linha)) return
    bloqueado.current = true
    setPendente(true)
    origemConfirmacao.current = null
    setConfirmacao(null)
    setAviso('Confirmando arquivamento...')
    const card = document.getElementById(idCard(linha.id))
    const inicioAntesDoEnvio = centro(card)
    try {
      // Persiste o comando inteiro antes da transmissão para recuperar a mesma intenção.
      const comando = anterior ?? { linha, chave: crypto.randomUUID() }
      sessionStorage.setItem(storageArquivo, JSON.stringify(comando))
      envioArquivoRef.current = comando
      setEnvioArquivo(comando)
      const form = new FormData()
      form.set('id', comando.linha.id)
      form.set('empresaId', comando.linha.empresaId)
      form.set('versao', String(comando.linha.versao))
      form.set('chave', comando.chave)
      const resultado = await enviar(semInteresseAcao, form)
      if (!vivo.current) return
      if (resultado.ok || (resultado.motivo !== 'sem_permissao' && resultado.motivo !== 'nao_encontrada')) {
        sessionStorage.removeItem(storageArquivo)
        envioArquivoRef.current = null
        setEnvioArquivo(null)
      }
      if (!resultado.ok) {
        setAviso(resultado.erro ?? 'Não foi possível arquivar. A empresa foi mantida.')
        return
      }
      if (resultado.atual === true) {
        setRemovidas(anteriores => new Set(anteriores).add(linha.id))
        if (negociacaoAberta === linha.id) {
          setPainel(null)
          limparSelecaoDaUrl()
        }
      }
      if (!resultado.repetida && resultado.atual === true) {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const inicio = card?.isConnected ? centro(card) : inicioAntesDoEnvio
          const fim = centro(iconeArquivo.current)
          if (inicio && fim) setAnimacao({ id: linha.id, nome: linha.nome, inicio, fim })
        }
        setAviso('Empresa marcada como Sem interesse. Retornos cancelados.')
      } else {
        setAviso(resultado.repetida ? 'Envio anterior confirmado. Situação atualizada sem repetir o arquivamento.' : 'Operação confirmada. Confira a situação atual da empresa.')
      }
      router.refresh()
    } catch {
      if (vivo.current) setAviso('Não foi possível confirmar o resultado. Confirme o envio anterior com a mesma chave.')
    } finally {
      bloqueado.current = false
      if (vivo.current) { setPendente(false); focarMensagem() }
    }
  }

  async function devolver(item: ArquivoFunilRecente, recuperar = false) {
    if (bloqueado.current || vendaBloqueada || envioArquivoRef.current || confirmacao) return
    const anterior = envioDevolucaoRef.current
    if (recuperar ? !anterior || cicloArquivo(anterior.item) !== cicloArquivo(item) : !!anterior) return
    bloqueado.current = true
    setPendente(true)
    setAviso('Confirmando devolução...')
    try {
      const comando = anterior ?? { item, chave: crypto.randomUUID() }
      sessionStorage.setItem(storageDevolucao, JSON.stringify(comando))
      envioDevolucaoRef.current = comando
      setEnvioDevolucao(comando)
      const form = new FormData()
      form.set('empresaId', comando.item.empresaId)
      form.set('negociacaoId', comando.item.negociacaoId)
      form.set('versao', String(comando.item.versao))
      form.set('chave', comando.chave)
      const resultado = await enviar(devolverFunilAcao, form)
      if (!vivo.current) return
      if (resultado.ok || (resultado.motivo !== 'sem_permissao' && resultado.motivo !== 'nao_encontrada')) {
        sessionStorage.removeItem(storageDevolucao)
        envioDevolucaoRef.current = null
        setEnvioDevolucao(null)
      }
      if (!resultado.ok && resultado.motivo !== 'desatualizada') {
        setAviso(textoDoMotivo(resultado.motivo))
        return
      }
      // O recorte antigo não deve oferecer outra tentativa com a mesma versão.
      setOcultacaoArquivo(anterior => ({
        base: arquivos,
        ciclos: new Set(anterior?.base === arquivos ? anterior.ciclos : undefined).add(cicloArquivo(item)),
      }))
      setAviso(resultado.ok
        ? resultado.aviso ?? (resultado.repetida ? 'Devolução anterior confirmada.' : 'Empresa devolvida para Primeiro contato.')
        : 'O arquivo desta empresa mudou. Confira os itens recentes.')
      try { router.refresh() }
      catch {
        setAviso(resultado.ok
          ? 'Devolução confirmada. Atualize a página para conferir o Funil.'
          : 'O arquivo desta empresa mudou. Atualize a página para conferir os itens recentes.')
      }
    } catch {
      if (vivo.current) setAviso(envioDevolucaoRef.current
        ? 'Não foi possível confirmar o resultado. Confirme a devolução anterior.'
        : 'Não foi possível salvar a devolução nesta aba. Nenhum envio foi feito.')
    } finally {
      bloqueado.current = false
      if (vivo.current) { setPendente(false); focarMensagem() }
    }
  }

  function confirmarDevolucao() {
    if (envioDevolucaoRef.current) void devolver(envioDevolucaoRef.current.item, true)
  }

  function abrirFicha(resultado: Extract<EstadoVenda, { ok: true }>) {
    const leitura = resultado.leituraDestino
    if (!leitura?.ok) {
      setAviso('Venda registrada. Não foi possível abrir a ficha. Atualize a página ou abra a Carteira.')
      focarMensagem()
      return
    }
    setAviso(resultado.aviso ?? 'Venda registrada.')
    try { router.replace('/carteira/' + leitura.destino.empresaId + '?venda=registrada') }
    catch { setAviso('Venda registrada. Não foi possível abrir a ficha. Abra a Carteira.'); focarMensagem() }
  }

  async function confirmarVenda() {
    if (bloqueado.current || confirmacao) return
    const primeira = venda.comando?.alvo.tipo === 'primeira'
    const resultado = await venda.enviar()
    if (!vivo.current || !resultado?.ok) return
    if (primeira) abrirFicha(resultado)
    else {
      setAviso(resultado.aviso ?? 'Venda registrada.')
      try { router.refresh() } catch { setAviso('Venda registrada. Atualize a página para conferir o histórico.') }
      focarMensagem()
    }
  }

  const linhaAberta = visiveis.find(linha => linha.id === negociacaoAberta)

  return <>
    <CabecalhoPagina titulo="Funil comercial" descricao="Acompanhe suas negociações até a primeira venda." acoes={
      <Button
        ref={botaoArquivo} type="button" variant="outline" data-descarte
        aria-expanded={painel?.tipo === 'arquivo'} aria-controls={painel?.tipo === 'arquivo' ? ID_ARQUIVO : undefined}
        className={[styles.lixeira, arrastando && styles.alvoArquivo, sobreLixeira && styles.sobreLixeira, animacao && styles.recebendoArquivo].filter(Boolean).join(' ')}
        onClick={evento => selecionarPainel({ tipo: 'arquivo' }, evento.currentTarget)}
        onDragOver={evento => {
          if (!arraste.current || !podeArrastar(arraste.current)) return
          evento.preventDefault()
          setSobreLixeira(true)
        }}
        onDragLeave={evento => {
          if (!(evento.relatedTarget instanceof Node) || !evento.currentTarget.contains(evento.relatedTarget)) setSobreLixeira(false)
        }}
        onDrop={soltarNaLixeira}
      ><IconeLixeira iconeRef={iconeArquivo}/>Sem interesse</Button>
    }/>
    <p role="status" tabIndex={-1} ref={mensagem} className={styles.aviso}>{aviso}</p>
    {venda.erro && <p role="alert">{venda.erro}</p>}
    {venda.comando && <section aria-label="Venda pendente" className={styles.recuperacao}>
      <p>Venda de R$ {venda.comando.entrada.valor} em {venda.comando.entrada.data.split('-').reverse().join('/')}. Confirme o envio anterior antes de registrar outra venda.</p>
      <Button type="button" disabled={venda.pendente || pendente || !!confirmacao} variant="outline" onClick={() => void confirmarVenda()}>{venda.pendente ? 'Confirmando venda...' : 'Confirmar venda anterior'}</Button>
    </section>}
    {envioArquivo && !pendente && <Button type="button" variant="outline" className={styles.retomarEnvio} disabled={vendaBloqueada || !!envioDevolucao} onClick={() => void arquivar(envioArquivo.linha)}>Confirmar envio anterior</Button>}
    {painel?.tipo !== 'arquivo' && envioDevolucao && !pendente && <RecuperacaoDevolucao item={envioDevolucao.item} bloqueado={vendaBloqueada || !!envioArquivo} aoConfirmar={confirmarDevolucao}/>}

    {painel?.tipo === 'empresa' && <DadosEmpresaPainel key={painel.id} referencia={painel.referencia} aoFechar={() => fecharPainel()}/>}
    {negociacaoAberta && <PainelNegociacao
      key={negociacaoAberta} id={negociacaoAberta} usuarioId={usuarioId} fechar={fecharPainel} fecharRef={fecharNegociacao}
      aoMudarBloqueioDeArraste={setArrasteBloqueado}
      bloqueada={pendente || !!envioArquivo || !!envioDevolucao || !!confirmacao}
      aoPedirArquivar={linhaAberta && disponivel(linhaAberta) ? () => pedirArquivamento(linhaAberta, document.activeElement as HTMLElement | null) : undefined}
    />}
    {painel?.tipo === 'arquivo' && <PainelArquivo
      arquivos={recentes} recuperacao={pendente ? undefined : envioDevolucao?.item}
      bloqueado={bloqueiaAcao} fechandoBloqueado={pendente || !!confirmacao}
      aoFechar={() => fecharPainel()} aoDevolver={item => void devolver(item)} aoConfirmar={confirmarDevolucao}
    />}

    {desktop && visiveis.length > 0 && <p className={styles.muted}>Arraste para a próxima etapa. Para arquivar, solte sobre Sem interesse.</p>}
    {visiveis.length === 0 && <EstadoVazio titulo="Nenhuma negociação aberta" descricao="Registre interesse ou combine um retorno no atendimento para começar." acao={{ rotulo: 'Ir para Prospecção', href: '/fila' }}/>}
    <div className={styles.quadro} aria-label="Negociações por etapa">{ETAPAS_FUNIL.map(etapa => {
      const cards = visiveis.filter(linha => linha.etapa === etapa)
      return <section key={etapa} data-etapa={etapa} className={[styles.coluna, destino === etapa && styles.destino].filter(Boolean).join(' ')}
        aria-label={ROTULOS_ETAPA[etapa]} aria-busy={pendente}
        onDragOver={evento => {
          if (arraste.current && podeArrastar(arraste.current) && destino === etapa) evento.preventDefault()
        }}
        onDrop={evento => void soltarNaEtapa(evento, etapa)}
      >
        <header><h2>{ROTULOS_ETAPA[etapa]}</h2><span aria-label={cards.length + ' negociações'}>{cards.length}</span></header>
        <div className={styles.cards}>
          {cards.map(linha => <article
            key={linha.id} id={idCard(linha.id)} data-slot="card" className={styles.card} tabIndex={-1}
            draggable={podeArrastar(linha)} onDragStart={evento => iniciarArraste(evento, linha)} onDragEnd={terminarArraste}
          >
            <div className={styles.identidadeCard}>
              <h3 title={linha.nome}>{linha.nome}</h3>
              <p className={styles.muted}>{[linha.empresa.cidade ?? linha.cidade, linha.empresa.uf].filter(Boolean).join(' / ')}</p>
            </div>
            <div className={styles.agendaCard}>
              {!linha.proximoPasso && !linha.retorno && <p className={styles.muted}>Sem próximo passo combinado</p>}
              {linha.proximoPasso && <p title={linha.proximoPasso}>{linha.proximoPasso}</p>}
              {linha.retorno && <time dateTime={linha.retorno}>Retorno em {dataEmpresa(linha.retorno)}</time>}
            </div>
            <div className={styles.acoesCard}>
              <Button type="button" variant="outline" size="sm" aria-pressed={painel?.tipo === 'empresa' && painel.id === linha.id}
                onClick={evento => selecionarPainel({ tipo: 'empresa', id: linha.id, referencia: linha.empresa.referencia }, evento.currentTarget)}>Dados da empresa</Button>
              <Button type="button" variant="outline" size="sm" aria-pressed={negociacaoAberta === linha.id}
                aria-controls={negociacaoAberta === linha.id ? 'painel-negociacao' : undefined}
                onClick={evento => selecionarPainel({ tipo: 'negociacao', id: linha.id }, evento.currentTarget)}>Negociação</Button>
            </div>
          </article>)}
          {cards.length === 0 && <p className={styles.semCards}>Sem negociações nesta etapa.</p>}
        </div>
      </section>
    })}</div>
    {confirmacao && <ConfirmarArquivamento nome={confirmacao.nome} aoCancelar={() => setConfirmacao(null)}
      aoConfirmar={() => void arquivar(confirmacao)} aoRestaurarFoco={() => {
        if (origemConfirmacao.current) focarOrigem(origemConfirmacao.current)
        origemConfirmacao.current = null
      }}
    />}
    {animacao && <EfeitoArquivo key={animacao.id} animacao={animacao} aoTerminar={limparAnimacao}/>}
  </>
}
