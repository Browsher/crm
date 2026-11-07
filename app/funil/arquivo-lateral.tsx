'use client'

import { useEffect, type CSSProperties, type RefObject } from 'react'
import Link from 'next/link'
import { PainelLateralCrm } from '@/src/components/crm/painel-lateral'
import { useTemaCrm } from '@/src/components/crm/tema'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent } from '@/src/components/ui/dialog'
import { ConfirmacaoPainelCrm } from '@/src/components/crm/confirmacao-painel'
import { EstadoPainelCrm } from '@/src/components/crm/estado-painel'
import { dataEmpresa } from '@/src/lib/empresa-visual'
import type { ArquivoFunilRecente } from '@/src/lib/funil-arquivo'
import styles from './funil.module.css'

export const ID_ARQUIVO = 'painel-sem-interesse'
export type FeedbackDevolucao = { tipo: 'pendente' | 'erro' | 'incerto' | 'sucesso'; texto: string; alvo?: string }
const TITULOS_DEVOLUCAO = { pendente: 'Confirmando devolução', erro: 'Não foi possível devolver', incerto: 'Devolução sem confirmação', sucesso: 'Devolução confirmada' }

export function IconeLixeira({ iconeRef }: { iconeRef?: RefObject<SVGSVGElement | null> }) {
  return <svg ref={iconeRef} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path className={styles.tampaLixeira} d="M3 7h18M9 7V4h6v3"/>
    <path d="m5 7 1 13h12l1-13M10 10v6m4-6v6"/>
  </svg>
}

export function PainelArquivo({ arquivos, recuperacao, feedback, bloqueado, fechandoBloqueado, aoFechar, aoDevolver, aoConfirmar }: {
  arquivos: ArquivoFunilRecente[]
  recuperacao?: ArquivoFunilRecente
  feedback?: FeedbackDevolucao
  bloqueado: boolean
  fechandoBloqueado: boolean
  aoFechar: () => void
  aoDevolver: (item: ArquivoFunilRecente) => void
  aoConfirmar: () => void
}) {
  return <PainelLateralCrm id={ID_ARQUIVO} titulo="Sem interesse" rotulo="Arquivo de prospecção" descricao="As três empresas arquivadas mais recentemente pelo Funil." aoFechar={aoFechar} fecharBloqueado={fechandoBloqueado}
    ocupado={fechandoBloqueado} rodape={<Button asChild variant="outline"><Link href="/fila/localizar?disponibilidade=sem_interesse&pagina=1">Ver todos em Sem interesse</Link></Button>}>
    <div className={styles.arquivo}>
      {feedback && <div data-feedback-devolucao><EstadoPainelCrm tipo={feedback.tipo} titulo={TITULOS_DEVOLUCAO[feedback.tipo]}
        descricao={(feedback.alvo ? feedback.alvo + '. ' : '') + feedback.texto} /></div>}
      {recuperacao && <RecuperacaoDevolucao item={recuperacao} bloqueado={fechandoBloqueado} aoConfirmar={aoConfirmar}/>}
      {arquivos.length > 0
        ? <ul className={styles.listaArquivo}>{arquivos.map(item => <li key={item.negociacaoId}>
          <div><strong>{item.nome}</strong><time dateTime={item.arquivadaEm}>{dataEmpresa(item.arquivadaEm)}</time></div>
          <Button variant="outline" type="button" aria-label={`Devolver ${item.nome} para Primeiro contato`} disabled={bloqueado} onClick={() => aoDevolver(item)}>Devolver</Button>
        </li>)}</ul>
        : <p className={styles.muted}>Nenhuma empresa em Sem interesse.</p>}
    </div>
  </PainelLateralCrm>
}

export function RecuperacaoDevolucao({ item, bloqueado, aoConfirmar }: {
  item: ArquivoFunilRecente
  bloqueado: boolean
  aoConfirmar: () => void
}) {
  return <section aria-label="Devolução pendente" className={styles.recuperacao}>
    <p>Confirme a devolução anterior de {item.nome}.</p>
    <Button variant="outline" type="button" disabled={bloqueado} onClick={aoConfirmar}>Confirmar devolução anterior</Button>
  </section>
}

export function ConfirmarArquivamento({ nome, aoCancelar, aoConfirmar, aoRestaurarFoco }: {
  nome: string
  aoCancelar: () => void
  aoConfirmar: () => void
  aoRestaurarFoco: () => void
}) {
  const tema = useTemaCrm()
  return <Dialog open onOpenChange={aberto => { if (!aberto) aoCancelar() }}>
    <DialogContent
      theme={tema}
      showCloseButton={false}
      className={styles.dialogoArquivo}
      onCloseAutoFocus={evento => { evento.preventDefault(); aoRestaurarFoco() }}
    >
      <ConfirmacaoPainelCrm titulo="Marcar como Sem interesse?" alvo={<strong>{nome}</strong>}
        descricao="A negociação sai do Funil e os retornos pendentes são cancelados. O histórico fica disponível em Sem interesse." acoes={<>
        <Button variant="outline" type="button" onClick={aoCancelar}>Cancelar</Button>
        <Button variant="destructive" type="button" onClick={aoConfirmar}>Confirmar Sem interesse</Button>
      </>} />
    </DialogContent>
  </Dialog>
}

type Ponto = { x: number; y: number }
export type AnimacaoArquivo = { id: string; nome: string; inicio: Ponto; fim: Ponto }
const PARTICULAS = [[-30, -19, -90], [-19, -34, 68], [-8, -25, 135], [4, -38, -72], [17, -30, 112], [30, -18, -48], [22, -7, 88], [-24, -8, -121]]
const DURACAO_ARQUIVO = 850

export function EfeitoArquivo({ animacao, aoTerminar }: { animacao: AnimacaoArquivo; aoTerminar: () => void }) {
  useEffect(() => {
    const tempo = window.setTimeout(aoTerminar, DURACAO_ARQUIVO)
    return () => window.clearTimeout(tempo)
  }, [aoTerminar])

  const { nome, inicio, fim } = animacao
  const deltaX = fim.x - inicio.x
  const deltaY = fim.y - inicio.y
  const voo = {
    left: inicio.x, top: inicio.y,
    '--voo-x': `${deltaX}px`, '--voo-y': `${deltaY}px`,
    '--meio-x': `${deltaX * 0.52}px`, '--meio-y': `${deltaY * 0.52 - 42}px`,
  } as CSSProperties
  return <div data-efeito-arquivo aria-hidden="true">
    <span className={styles.cartaoVoando} style={voo}>{nome}</span>
    <span className={styles.particulasArquivo} style={{ left: fim.x, top: fim.y }}>
      {PARTICULAS.map(([x, y, rotacao]) => <i key={x} style={{ '--particula-x': `${x}px`, '--particula-y': `${y}px`, '--rotacao': `${rotacao}deg` } as CSSProperties}/>)}
    </span>
  </div>
}
