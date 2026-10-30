'use client'
import { useEffect, useRef, useState } from 'react'
import { lerDetalhesEmpresaAcao } from '@/app/empresas/busca/detalhe-acao'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { MOTIVOS_INDISPONIBILIDADE } from '@/src/lib/empresa-visual'
import type { ResultadoDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { EmpresaDetalhes } from './empresa-detalhes'
import { useTemaCrm } from './tema'
import styles from './empresa.module.css'

// A chave desmonta a seleção anterior antes do próximo paint e invalida seu efeito.
export function EmpresaDialogo({ referencia, aoFechar }: { referencia: ReferenciaEmpresa; aoFechar: () => void }) {
  const chave = referencia.tipo === 'cadastro' ? `cadastro:${referencia.empresaId}` : `busca:${referencia.buscaId}:${referencia.cnpj}`
  const origem = useRef<HTMLElement | null>(null)
  return <Dialog open onOpenChange={aberto => { if (!aberto) aoFechar() }}><Conteudo key={chave} referencia={referencia} guardarFoco={() => { origem.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null }} devolverFoco={() => { if (origem.current?.isConnected) origem.current.focus() }} /></Dialog>
}
function Conteudo({ referencia, guardarFoco, devolverFoco }: { referencia: ReferenciaEmpresa; guardarFoco: () => void; devolverFoco: () => void }) {
  const [resultado, setResultado] = useState<ResultadoDetalhesEmpresa | null>(null)
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const titulo = useRef<HTMLHeadingElement>(null)
  const tema = useTemaCrm()
  const tipo = referencia.tipo, id = referencia.tipo === 'cadastro' ? referencia.empresaId : referencia.buscaId, cnpj = referencia.tipo === 'busca' ? referencia.cnpj : ''
  useEffect(() => {
    let atual = true
    lerDetalhesEmpresaAcao(tipo === 'cadastro' ? { tipo, empresaId: id } : { tipo, buscaId: id, cnpj }).then(r => { if (atual) setResultado(r) }, () => { if (atual) setErro(true) })
    return () => { atual = false }
  }, [tipo, id, cnpj, tentativa])
  return <DialogContent theme={tema} className={styles.dialogo} onOpenAutoFocus={e => { e.preventDefault(); guardarFoco(); titulo.current?.focus() }} onCloseAutoFocus={e => { e.preventDefault(); devolverFoco() }}>
    <DialogHeader><DialogTitle ref={titulo} tabIndex={-1}>Ver empresa</DialogTitle><DialogDescription>Dados salvos da empresa selecionada.</DialogDescription></DialogHeader>
    <div className={styles.corpo} aria-busy={!resultado && !erro}>
      {!resultado && !erro && <p role="status">Carregando empresa…</p>}
      {(erro || resultado?.ok === false) && <div><p role="alert">{erro ? 'Não foi possível carregar a empresa. Tente novamente.' : 'Esta empresa não está disponível para você.'}</p>{erro && <Button type="button" variant="outline" onClick={() => { setErro(false); setResultado(null); setTentativa(t => t + 1) }}>Tentar novamente</Button>}</div>}
      {resultado?.ok && <><h3 className={styles.nome}>{resultado.dados.nome}</h3>{resultado.dados.motivoIndisponibilidade && <p className={styles.muted}>{MOTIVOS_INDISPONIBILIDADE[resultado.dados.motivoIndisponibilidade]}</p>}<EmpresaDetalhes empresa={resultado.dados} /></>}
    </div>
  </DialogContent>
}
