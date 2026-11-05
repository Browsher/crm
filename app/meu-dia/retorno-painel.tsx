'use client'

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import type { Contato } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { PainelLateralCrm } from '@/src/components/crm/painel-lateral'
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
  aoMudarAba: (aba: AbaRetorno) => void
  aoFechar: () => void
  aoDados: (gatilho: HTMLElement) => void
  aoNegociacao: (gatilho: HTMLElement) => void
  aoRemover: (id: string) => void
}

export function RetornoPainel({ empresa, filtros, aba, aoMudarAba, aoFechar, aoDados, aoNegociacao, aoRemover }: Props) {
  const [historico, setHistorico] = useState<Historico>(null)
  const [tentativa, setTentativa] = useState(0)
  const abasId = useId()
  const empresaId = empresa.id
  useEffect(() => {
    let vivo = true
    void historicoDaAgendaAcao(empresaId).then(resultado => {
      if (!vivo) return
      if (!resultado.ok && resultado.motivo === 'fora_da_carteira') { aoRemover(empresaId); return }
      setHistorico(resultado.ok ? { fase: 'pronto', contatos: resultado.contatos } : { fase: 'erro' })
    }, () => { if (vivo) setHistorico({ fase: 'erro' }) })
    return () => { vivo = false }
  }, [empresaId, tentativa, aoRemover])
  const abas = [{ id: 'passo', nome: 'Próximo passo' }, { id: 'historico', nome: 'Histórico' }] as const
  const negociacao = empresa.situacao !== 'cliente' && empresa.empresa?.negociacaoId
  return <PainelLateralCrm titulo={nomeEmpresa(empresa)} rotulo="Retorno" className={styles.painelRetorno}
    descricao={empresa.situacaoRetorno === 'atrasado' ? 'Retorno atrasado' : empresa.situacaoRetorno === 'hoje' ? 'Retorno de hoje' : 'Próximo retorno'}
    rotuloFechar={aba === 'historico' ? 'Voltar' : 'Fechar'}
    aoFechar={() => aba === 'historico' ? aoMudarAba('passo') : aoFechar()}>
    <div role="tablist" aria-label="Retorno" className={styles.abas} onKeyDown={evento => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return
      evento.preventDefault()
      const proxima = evento.key === 'Home' ? 'passo' : evento.key === 'End' ? 'historico' : aba === 'passo' ? 'historico' : 'passo'
      aoMudarAba(proxima)
      document.getElementById(abasId + '-' + proxima)?.focus()
    }}>
      {abas.map(item => <Button key={item.id} variant="ghost" role="tab" id={abasId + '-' + item.id}
        aria-selected={aba === item.id} tabIndex={aba === item.id ? 0 : -1}
        aria-controls={abasId + '-painel-' + item.id} onClick={() => aoMudarAba(item.id)}>{item.nome}</Button>)}
    </div>
    <section className={styles.conteudoRetorno} role="tabpanel" hidden={aba !== 'passo'} id={abasId + '-painel-passo'} aria-labelledby={abasId + '-passo'}>
      <dl className={styles.dados}>
        <div><dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Sem próximo passo combinado'}</dd></div>
        <div><dt>Retorno</dt><dd>{empresa.proximoPassoData ? <time dateTime={empresa.proximoPassoData}>{empresa.proximoPassoData.split('-').reverse().join('/')}</time> : 'Sem retorno agendado'}</dd></div>
      </dl>
    </section>
    <section className={styles.conteudoRetorno} role="tabpanel" hidden={aba !== 'historico'} id={abasId + '-painel-historico'} aria-labelledby={abasId + '-historico'}>
      {aba === 'historico' && (!historico ? <p role="status">Carregando histórico</p>
        : historico.fase === 'pronto' ? <LinhaDoTempo contatos={historico.contatos} />
          : <div><p role="alert">Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => { setHistorico(null); setTentativa(t => t + 1) }}>Tentar novamente</Button></div>)}
    </section>
    <footer className={styles.rodapeRetorno}>
      <span>Ações do retorno</span>
      <div>
        <Button id={'meu-dia-dados-' + empresa.id} variant="outline" onClick={evento => aoDados(evento.currentTarget)}>Dados da empresa</Button>
        {negociacao ? <Button id={'meu-dia-negociacao-' + empresa.id} onClick={evento => aoNegociacao(evento.currentTarget)}>Negociação</Button>
          : <Button asChild><Link href={urlFichaDoMeuDia(empresa.id, filtros)}>Atendimento</Link></Button>}
      </div>
    </footer>
  </PainelLateralCrm>
}
