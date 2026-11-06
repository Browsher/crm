'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Contato } from '@/src/features/contato/historico'
import { eventosDeContatos, LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { PainelLateralCrm } from '@/src/components/crm/painel-lateral'
import { MenuPainelCrm } from '@/src/components/crm/menu-painel'
import { EstadoPainelCrm } from '@/src/components/crm/estado-painel'
import { filtrarEventosHistorico, type FiltroHistoricoComercial } from '@/src/lib/historico-comercial'
import { Button } from '@/src/components/ui/button'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import { historicoDaAgendaAcao } from './historico-acao'
import { urlFichaDoMeuDia, type FiltrosMeuDia } from './agenda'
import type { LinhaMeuDia } from './painel'
import styles from './meu-dia.module.css'

export type AbaRetorno = 'passo' | 'historico'
type Historico = { fase: 'pronto'; contatos: Contato[] } | { fase: 'erro' } | null
type Props = {
  empresa: LinhaMeuDia
  filtros: FiltrosMeuDia
  aba: AbaRetorno
  bloqueado?: boolean
  aoMudarAba: (aba: AbaRetorno) => void
  aoFechar: () => void
  aoDados: (gatilho: HTMLElement) => void
  aoNegociacao: (gatilho: HTMLElement) => void
  aoRemover: (id: string) => void
}

export function RetornoPainel({ empresa, filtros, aba, bloqueado = false, aoMudarAba, aoFechar, aoDados, aoNegociacao, aoRemover }: Props) {
  const [historico, setHistorico] = useState<Historico>(null)
  const [tentativa, setTentativa] = useState(0)
  const [filtro, setFiltro] = useState<FiltroHistoricoComercial>('todos')
  const [identidadeFiltro, setIdentidadeFiltro] = useState('')
  const tituloHistorico = useRef<HTMLHeadingElement>(null)
  const abaAnterior = useRef(aba)
  const empresaId = empresa.id
  useLayoutEffect(() => {
    if (aba === 'historico') tituloHistorico.current?.focus({ preventScroll: true })
    else if (abaAnterior.current === 'historico') document.getElementById('meu-dia-historico-' + empresaId)?.focus({ preventScroll: true })
    abaAnterior.current = aba
  }, [aba, empresaId])
  useEffect(() => {
    let vivo = true
    void historicoDaAgendaAcao(empresaId).then(resultado => {
      if (!vivo) return
      if (!resultado.ok && resultado.motivo === 'fora_da_carteira') { aoRemover(empresaId); return }
      setHistorico(resultado.ok ? { fase: 'pronto', contatos: resultado.contatos } : { fase: 'erro' })
    }, () => { if (vivo) setHistorico({ fase: 'erro' }) })
    return () => { vivo = false }
  }, [empresaId, tentativa, aoRemover])
  const eventos = historico?.fase === 'pronto' ? eventosDeContatos(historico.contatos) : []
  const identidadeAtual = JSON.stringify([empresaId, eventos.map(evento => evento.id)])
  // O dono controla o vazio e o rodapé; uma nova identidade reinicia o recorte.
  if (identidadeFiltro !== identidadeAtual) {
    setIdentidadeFiltro(identidadeAtual)
    setFiltro('todos')
  }
  const filtroVazio = eventos.length > 0 && filtrarEventosHistorico(eventos, filtro).length === 0
  const negociacao = empresa.situacao !== 'cliente' && empresa.empresa?.negociacaoId
  const comercial = negociacao
    ? <Button id={'meu-dia-negociacao-' + empresa.id} disabled={bloqueado} onClick={evento => aoNegociacao(evento.currentTarget)}>Negociação</Button>
    : <Button asChild><Link href={urlFichaDoMeuDia(empresa.id, filtros)}>Atendimento</Link></Button>
  const rodape = aba === 'historico' && historico?.fase === 'erro'
    ? <Button variant="outline" disabled={bloqueado} onClick={() => { setHistorico(null); setTentativa(t => t + 1) }}>Tentar novamente</Button>
    : aba === 'historico' && filtroVazio
      ? <Button variant="outline" disabled={bloqueado} onClick={() => setFiltro('todos')}>Ver todos</Button>
      : comercial
  return <PainelLateralCrm titulo={nomeEmpresa(empresa)} rotulo="Retorno"
    descricao={empresa.situacaoRetorno === 'atrasado' ? 'Retorno atrasado' : empresa.situacaoRetorno === 'hoje' ? 'Retorno de hoje' : 'Próximo retorno'}
    rotuloFechar={aba === 'historico' ? 'Voltar' : 'Fechar'} fecharBloqueado={bloqueado}
    aoFechar={() => aba === 'historico' ? aoMudarAba('passo') : aoFechar()}
    rodape={rodape} ocupado={aba === 'historico' && !historico}>
    {aba === 'passo' ? <div className={styles.conteudoRetorno}>
      <dl className={styles.dados}>
        <div><dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</dd></div>
        <div><dt>Retorno</dt><dd>{empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{empresa.proximoPassoData.split('-').reverse().join('/')}</time> : 'Sem retorno agendado'}</dd></div>
      </dl>
      <MenuPainelCrm rotulo="Seções da empresa" itens={[
        { id: 'meu-dia-dados-' + empresa.id, titulo: 'Dados da empresa', desabilitado: bloqueado, aoAbrir: aoDados },
        { id: 'meu-dia-historico-' + empresa.id, titulo: 'Histórico', desabilitado: bloqueado, aoAbrir: () => aoMudarAba('historico') },
      ]} />
    </div> : <section className={styles.conteudoRetorno} aria-label="Histórico do retorno">
      <h3 ref={tituloHistorico} tabIndex={-1}>Histórico</h3>
      {!historico ? <EstadoPainelCrm tipo="carregando" titulo="Carregando histórico" descricao="Aguarde os registros desta empresa." />
        : historico.fase === 'erro' ? <EstadoPainelCrm tipo="erro" titulo="Não foi possível carregar o histórico." descricao="Tente novamente para consultar os registros." />
          : <LinhaDoTempo contatos={historico.contatos} controleFiltro={{ valor: filtro, aoMudar: setFiltro }}
            conteudoVazio={eventos.length === 0
              ? <EstadoPainelCrm tipo="vazio" titulo="Nenhum contato registrado nesta empresa ainda." descricao="Os atendimentos registrados nesta empresa aparecerão aqui." />
              : <EstadoPainelCrm tipo="vazio" titulo="Nenhum registro neste filtro." descricao="Escolha outro filtro ou veja todos os registros." />} />}
    </section>}
  </PainelLateralCrm>
}
