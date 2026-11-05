'use client'
import { useEffect, useRef, useState } from 'react'
import { lerDetalhesEmpresaAcao } from '@/app/empresas/busca/detalhe-acao'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { dataEmpresa, MOTIVOS_INDISPONIBILIDADE } from '@/src/lib/empresa-visual'
import type { ResultadoDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Card, CardContent, CardHeader } from '@/src/components/ui/card'
import { EmpresaDetalhes } from './empresa-detalhes'
import { PainelLateralCrm } from './painel-lateral'
import { useTemaCrm } from './tema'
import styles from './empresa.module.css'

type Props = { referencia: ReferenciaEmpresa; aoFechar: () => void }

// A chave desmonta a seleção anterior antes do próximo paint e invalida seu efeito.
function chaveReferencia(ref: ReferenciaEmpresa) {
  return ref.tipo === 'cadastro' ? 'cadastro:'+ref.empresaId : 'busca:'+ref.buscaId+':'+ref.cnpj
}

export function EmpresaDialogo({ referencia, aoFechar }: Props) {
  const origem = useRef<HTMLElement | null>(null)
  return <Dialog open onOpenChange={aberto => { if (!aberto) aoFechar() }}>
    <ConteudoDialogo key={chaveReferencia(referencia)} referencia={referencia}
      guardarFoco={() => { origem.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null }}
      devolverFoco={() => { if (origem.current?.isConnected) origem.current.focus() }} />
  </Dialog>
}

function ConteudoDialogo({ referencia, guardarFoco, devolverFoco }: { referencia: ReferenciaEmpresa; guardarFoco: () => void; devolverFoco: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  const tema = useTemaCrm()
  return <DialogContent theme={tema} className={styles.dialogo}
    onOpenAutoFocus={e => { e.preventDefault(); guardarFoco(); titulo.current?.focus() }}
    onCloseAutoFocus={e => { e.preventDefault(); devolverFoco() }}>
    <DialogHeader><DialogTitle ref={titulo} tabIndex={-1}>Ver empresa</DialogTitle><DialogDescription>Dados salvos da empresa selecionada.</DialogDescription></DialogHeader>
    <ConteudoEmpresa referencia={referencia} />
  </DialogContent>
}

export function DadosEmpresaPainel({ referencia, aoFechar }: Props) {
  return <PainelLateralCrm key={chaveReferencia(referencia)} titulo="Dados da empresa" aoFechar={aoFechar} className={styles.lateral}>
    <ConteudoEmpresa referencia={referencia} lateral />
  </PainelLateralCrm>
}

const origens = { google: 'Google', banco: 'Banco de empresas', legado: 'Legado' }

function ConteudoEmpresa({ referencia, lateral = false }: { referencia: ReferenciaEmpresa; lateral?: boolean }) {
  const [resultado, setResultado] = useState<ResultadoDetalhesEmpresa | null>(null)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const tipo = referencia.tipo, id = referencia.tipo === 'cadastro' ? referencia.empresaId : referencia.buscaId, cnpj = referencia.tipo === 'busca' ? referencia.cnpj : ''
  useEffect(() => {
    let atual = true
    lerDetalhesEmpresaAcao(tipo === 'cadastro' ? { tipo, empresaId: id } : { tipo, buscaId: id, cnpj }).then(r => { if (atual) setResultado(r) }, () => { if (atual) setErro(true) })
    return () => { atual = false }
  }, [tipo, id, cnpj, tentativa])
  return <div className={lateral ? styles.dadosLateral : styles.corpo} aria-busy={!resultado && !erro}>
    {!resultado && !erro && <p role="status">Carregando empresa…</p>}
    {(erro || resultado?.ok === false) && <div><p role="alert">{erro ? 'Não foi possível carregar a empresa. Tente novamente.' : 'Esta empresa não está disponível para você.'}</p>{erro && <Button type="button" variant="outline" onClick={() => { setErro(false); setResultado(null); setTentativa(t => t + 1) }}>Tentar novamente</Button>}</div>}
    {resultado?.ok && <>
      <h3 className={styles.nome}>{resultado.dados.nome}</h3>
      {resultado.dados.motivoIndisponibilidade && <p className={styles.muted}>{MOTIVOS_INDISPONIBILIDADE[resultado.dados.motivoIndisponibilidade]}</p>}
      <EmpresaDetalhes empresa={resultado.dados} contatosPrimeiro={lateral} />
      {lateral && <Card><CardHeader><h4>Origem</h4></CardHeader><CardContent><dl className={styles.dados}>
        <div><dt>Encontrada em</dt><dd>{resultado.dados.origens.map(o => origens[o]).join(', ') || 'Não informado'}</dd></div>
        <div><dt>Recebida em</dt><dd>{dataEmpresa(resultado.dados.recebidaEm)}</dd></div>
      </dl></CardContent></Card>}
    </>}
  </div>
}
