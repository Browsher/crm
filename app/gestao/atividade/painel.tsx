'use client'

import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { BadgeCheck, ChevronRight, Database, MapPin, Phone, TriangleAlert, Workflow } from 'lucide-react'
import { PainelSobrepostoCrm } from '@/src/components/crm/painel-lateral'
import { Button } from '@/src/components/ui/button'
import { Dialog } from '@/src/components/ui/dialog'
import { NativeSelect } from '@/src/components/ui/native-select'
import { dataCivilSaoPaulo } from '@/src/lib/agenda-periodos'
import {
  descricaoAtividade, detalhesAtividade, FILTROS_ATIVIDADE, PAGINA_ATIVIDADE, PERIODOS_ATIVIDADE, TIPOS_ATIVIDADE,
  tituloAtividade, type EventoAtividade, type FiltrosAtividade, type PaginaAtividade,
} from '@/src/lib/atividade-gestao'
import { consultarAtividadeAcao } from './acoes'
import styles from './painel.module.css'

type Vendedor = { id: string; nome: string }
type Props = {
  destaques: readonly EventoAtividade[]
  alerta?: EventoAtividade
  vendedores?: readonly Vendedor[]
  perfil?: Vendedor
  hoje?: string
}
type Visao = { tipo: 'historico'; detalhe?: EventoAtividade } | { tipo: 'destaque'; detalhe: EventoAtividade }
type Consulta = { estado: 'carregando' | 'erro' } | { estado: 'pronto'; resultado: PaginaAtividade }
type AbrirEvento = (evento: EventoAtividade, gatilho: HTMLButtonElement) => void

const icones = { venda: BadgeCheck, contato: Phone, funil: Workflow, banco: Database, google: MapPin }
const rotulosAcao = { venda: 'Ver empresa', contato: 'Ver empresa', funil: 'Ver empresa', banco: 'Ver busca', google: 'Ver entrega' }
const horaBrasilia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

function rotulosDeData(agora: Date) {
  const hoje = dataCivilSaoPaulo(agora)
  const dataAnterior = new Date(`${hoje}T12:00:00Z`)
  dataAnterior.setUTCDate(dataAnterior.getUTCDate() - 1)
  const ontem = dataAnterior.toISOString().slice(0, 10)
  return (data: string) => {
    if (data === hoje) return 'Hoje'
    if (data === ontem) return 'Ontem'
    return data.split('-').reverse().join('/')
  }
}

function horario(em: string, rotuloData: ReturnType<typeof rotulosDeData>, mostrarDia: boolean) {
  const data = new Date(em)
  const hora = horaBrasilia.format(data)
  return mostrarDia ? `${rotuloData(dataCivilSaoPaulo(data))}, ${hora}` : hora
}

function agruparEventos(eventos: readonly EventoAtividade[]) {
  const grupos = new Map<string, EventoAtividade[]>()
  for (const evento of eventos) {
    const dia = dataCivilSaoPaulo(new Date(evento.em))
    const grupo = grupos.get(dia)
    if (grupo) grupo.push(evento)
    else grupos.set(dia, [evento])
  }
  return [...grupos.entries()]
}

function ListaEventos({ eventos, rotuloData, agrupada = false, aoAbrir }: {
  eventos: readonly EventoAtividade[]
  rotuloData: ReturnType<typeof rotulosDeData>
  agrupada?: boolean
  aoAbrir: AbrirEvento
}) {
  return <ol className={styles.lista}>
    {eventos.map(evento => {
      const falhou = evento.subtipo === 'falhou'
      const Icone = falhou ? TriangleAlert : icones[evento.categoria]
      const acao = falhou ? 'Ver falha' : rotulosAcao[evento.categoria]
      const titulo = tituloAtividade(evento)
      const descricao = descricaoAtividade(evento)
      return <li key={`${evento.categoria}-${evento.id}`} className={styles.registro}>
        <span className={styles.sinal} data-tom={falhou ? 'falha' : evento.categoria}><Icone size={16} aria-hidden="true" /></span>
        <div className={styles.textoRegistro}>
          <strong>{titulo}</strong>
          {descricao && <p>{descricao}</p>}
        </div>
        <div className={styles.acoesRegistro}>
          <time dateTime={evento.em}>{horario(evento.em, rotuloData, !agrupada)}</time>
          <Button type="button" size="xs" variant="outline" aria-haspopup={agrupada ? undefined : 'dialog'}
            aria-label={`${acao}: ${titulo}`} onClick={clique => aoAbrir(evento, clique.currentTarget)}>{acao}</Button>
        </div>
      </li>
    })}
  </ol>
}

export function AtividadeRecente({ destaques, alerta, vendedores = [], perfil, hoje }: Props) {
  const secaoId = useId()
  const [visao, setVisao] = useState<Visao | null>(null)
  const [filtros, setFiltros] = useState(FILTROS_ATIVIDADE)
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const sequencia = useRef(0)
  const gatilhoPainel = useRef<HTMLButtonElement>(null)
  const gatilhoDetalhe = useRef<HTMLButtonElement>(null)
  const rolagemHistorico = useRef(0)
  const conteudoHistorico = useRef<HTMLDivElement>(null)
  const conteudoDetalhe = useRef<HTMLDivElement>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const [agora, setAgora] = useState(() => new Date(hoje ?? Date.now()))
  const rotuloData = rotulosDeData(agora)
  const detalhe = visao?.detalhe
  const dentroDoHistorico = visao?.tipo === 'historico'

  useLayoutEffect(() => {
    if (detalhe) {
      const corpo = conteudoDetalhe.current?.closest<HTMLElement>('[data-painel-corpo]')
      if (corpo) corpo.scrollTop = 0
      corpo?.parentElement?.querySelector('h2')?.focus({ preventScroll: true })
    } else if (gatilhoDetalhe.current?.isConnected) {
      const corpo = conteudoHistorico.current?.closest<HTMLElement>('[data-painel-corpo]')
      if (corpo) corpo.scrollTop = rolagemHistorico.current
      gatilhoDetalhe.current.focus({ preventScroll: true })
      gatilhoDetalhe.current = null
    }
  }, [detalhe])

  async function carregar(proximos: FiltrosAtividade) {
    const pedido = ++sequencia.current
    setFiltros(proximos)
    setConsulta({ estado: 'carregando' })
    let resultado: PaginaAtividade | null
    try {
      resultado = await consultarAtividadeAcao(proximos)
    } catch {
      resultado = null
    }
    if (pedido !== sequencia.current) return
    if (resultado?.referencia) setAgora(new Date(resultado.referencia))
    setConsulta(resultado ? { estado: 'pronto', resultado } : { estado: 'erro' })
  }

  function abrirHistorico(evento: MouseEvent<HTMLButtonElement>) {
    gatilhoPainel.current = evento.currentTarget
    setAgora(new Date())
    setVisao({ tipo: 'historico' })
    void carregar({ ...FILTROS_ATIVIDADE, vendedorId: perfil?.id ?? null })
  }

  const abrirDestaque: AbrirEvento = (evento, gatilho) => {
    gatilhoPainel.current = gatilho
    setAgora(new Date())
    setVisao({ tipo: 'destaque', detalhe: evento })
  }

  const abrirDetalhe: AbrirEvento = (evento, gatilho) => {
    gatilhoDetalhe.current = gatilho
    rolagemHistorico.current = gatilho.closest<HTMLElement>('[data-painel-corpo]')?.scrollTop ?? 0
    setVisao({ tipo: 'historico', detalhe: evento })
  }

  function voltarOuFechar() {
    if (dentroDoHistorico && detalhe) {
      setVisao({ tipo: 'historico' })
      return
    }
    ++sequencia.current
    setVisao(null)
  }

  function mudarFiltro(alteracao: Partial<FiltrosAtividade>) {
    const corpo = conteudoHistorico.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (corpo) corpo.scrollTop = 0
    void carregar({ ...filtros, ...alteracao, pagina: 1 })
  }

  function mostrarPagina(pagina: number) {
    const corpo = conteudoHistorico.current?.closest<HTMLElement>('[data-painel-corpo]')
    if (corpo) corpo.scrollTop = 0
    status.current?.focus({ preventScroll: true })
    void carregar({ ...filtros, pagina })
  }

  const resultado = consulta?.estado === 'pronto' ? consulta.resultado : undefined
  const total = resultado?.total ?? 0
  const totalPaginas = Math.ceil(total / PAGINA_ATIVIDADE)
  const registros = `${total.toLocaleString('pt-BR')} ${total === 1 ? 'registro' : 'registros'}`
  const dataPainel = perfil ? `${perfil.nome} · Horário de Brasília` : 'Vendedores ativos · Horário de Brasília'
  const tituloDetalhe = detalhe && tituloAtividade(detalhe)
  const detalheEmpresa = detalhe && rotulosAcao[detalhe.categoria] === 'Ver empresa'

  return <>
    <section className={styles.atividade} aria-labelledby={secaoId}>
      <header className={styles.cabecalho}>
        <h2 id={secaoId}>Atividade recente</h2>
        <p>{perfil ? `Registros de ${dataPainel}` : dataPainel}</p>
      </header>
      {!perfil && alerta && <div className={styles.alerta}>
        <TriangleAlert size={16} aria-hidden="true" />
        <div>
          <strong>{alerta.categoria === 'google' ? 'Uma coleta do Google falhou' : 'Uma busca do Banco falhou'}</strong>
          <p>{alerta.vendedor} · <time dateTime={alerta.em}>{horario(alerta.em, rotuloData, true)}</time></p>
        </div>
        <Button type="button" size="xs" variant="ghost" aria-haspopup="dialog" onClick={evento => abrirDestaque(alerta, evento.currentTarget)}>Ver falha</Button>
      </div>}
      <div className={styles.destaques}>
        {destaques.length ? <ListaEventos eventos={destaques} rotuloData={rotuloData} aoAbrir={abrirDestaque} /> :
          <p className={styles.mensagem}>Nenhum destaque recente.</p>}
      </div>
      <footer className={styles.rodapeDestaques}>
        <Button type="button" size="sm" variant="outline" aria-haspopup="dialog" onClick={abrirHistorico}>
          Ver atividade completa <ChevronRight aria-hidden="true" />
        </Button>
      </footer>
    </section>

    <Dialog open={visao !== null}>
      {visao && <PainelSobrepostoCrm className={styles.painel}
        titulo={detalhe ? detalheEmpresa ? 'Histórico da empresa' : tituloDetalhe! : 'Atividade completa'}
        descricao={detalhe ? `${detalhe.vendedor} · ${horario(detalhe.em, rotuloData, true)}` : dataPainel}
        rotuloFechar={dentroDoHistorico && detalhe ? 'Voltar' : 'Fechar'} aoFechar={voltarOuFechar}
        onCloseAutoFocus={evento => {
          evento.preventDefault()
          if (gatilhoPainel.current?.isConnected) gatilhoPainel.current.focus({ preventScroll: true })
        }}>
        {dentroDoHistorico && <div ref={conteudoHistorico} hidden={Boolean(detalhe)}>
          <div className={styles.filtros} data-equipe={!perfil}>
            {!perfil && <label>Vendedor
              <NativeSelect value={filtros.vendedorId ?? ''} onChange={evento => mudarFiltro({ vendedorId: evento.currentTarget.value || null })}>
                <option value="">Todos</option>
                {vendedores.map(vendedor => <option value={vendedor.id} key={vendedor.id}>{vendedor.nome}</option>)}
              </NativeSelect>
            </label>}
            <label>Período
              <NativeSelect value={filtros.periodo} onChange={evento => mudarFiltro({ periodo: evento.currentTarget.value as FiltrosAtividade['periodo'] })}>
                {Object.entries(PERIODOS_ATIVIDADE).map(([valor, rotulo]) => <option value={valor} key={valor}>{rotulo}</option>)}
              </NativeSelect>
            </label>
            <label>Tipo
              <NativeSelect value={filtros.tipo} onChange={evento => mudarFiltro({ tipo: evento.currentTarget.value as FiltrosAtividade['tipo'] })}>
                {Object.entries(TIPOS_ATIVIDADE).map(([valor, rotulo]) => <option value={valor} key={valor}>{rotulo}</option>)}
              </NativeSelect>
            </label>
          </div>
          <p ref={status} tabIndex={-1} role="status" className={styles.contagem}>
            {consulta?.estado === 'carregando' ? 'Carregando atividade…' : resultado ? registros : null}
          </p>
          {consulta?.estado === 'erro' && <div className={styles.erro}>
            <p role="alert">Não foi possível carregar a atividade.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => mostrarPagina(filtros.pagina)}>Tentar novamente</Button>
          </div>}
          {resultado && <>
            {resultado.eventos.length === 0 && <p className={styles.mensagem}>Nenhum registro com estes filtros.</p>}
            {agruparEventos(resultado.eventos).map(([dia, eventos]) => <div key={dia} className={styles.grupo}>
              <h3><time dateTime={dia}>{rotuloData(dia)}</time></h3>
              <ListaEventos eventos={eventos} rotuloData={rotuloData} aoAbrir={abrirDetalhe} agrupada />
            </div>)}
            {(totalPaginas > 1 || filtros.pagina > 1) && <nav aria-label="Páginas da atividade" className={styles.paginacao}>
              <p>Página {filtros.pagina.toLocaleString('pt-BR')}{totalPaginas >= filtros.pagina && ` de ${totalPaginas.toLocaleString('pt-BR')}`}</p>
              <div>
                <Button type="button" size="sm" variant="outline" disabled={filtros.pagina === 1} onClick={() => mostrarPagina(filtros.pagina - 1)}>Anterior</Button>
                <Button type="button" size="sm" variant="outline" disabled={filtros.pagina >= totalPaginas} onClick={() => mostrarPagina(filtros.pagina + 1)}>Próxima</Button>
              </div>
            </nav>}
          </>}
        </div>}
        {detalhe && <div ref={conteudoDetalhe} className={styles.detalhe}>
          {detalheEmpresa && <h3>{tituloDetalhe}</h3>}
          <dl>
            {detalhesAtividade(detalhe).map(({ rotulo, valor }) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}
          </dl>
        </div>}
      </PainelSobrepostoCrm>}
    </Dialog>
  </>
}
