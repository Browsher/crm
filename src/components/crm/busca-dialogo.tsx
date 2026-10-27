'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { Alert } from '@/src/components/ui/alert'
import { useTemaCrm } from './tema'
import styles from './busca-dialogo.module.css'

type Resultado = { ok: true; conteudo: ReactNode } | { ok: false; erro: string }
type Props = { nome: string; carregarAcao: () => Promise<Resultado>; abrirInicialmente?: boolean; conteudoInicial?: ReactNode; rotulo?: string }
export function BuscaDialogo({ nome, carregarAcao, abrirInicialmente = false, conteudoInicial, rotulo = 'Ver busca' }: Props) {
  const tema = useTemaCrm()
  const [aberto, setAberto] = useState(abrirInicialmente)
  const [conteudo, setConteudo] = useState<ReactNode>(conteudoInicial ?? null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const pedido = useRef(0)

  async function carregar() {
    const atual = ++pedido.current
    setConteudo(null); setErro(''); setCarregando(true)
    try {
      const r = await carregarAcao()
      if (atual !== pedido.current) return
      if (r.ok) setConteudo(r.conteudo)
      else setErro(r.erro)
    } catch {
      if (atual === pedido.current) setErro('Não foi possível carregar a busca. Tente novamente.')
    } finally {
      if (atual === pedido.current) setCarregando(false)
    }
  }
  function mudar(aberto: boolean) {
    setAberto(aberto)
    if (aberto) void carregar()
    else { pedido.current++; setConteudo(null) }
  }
  return <Dialog open={aberto} onOpenChange={mudar}>
    <DialogTrigger asChild><Button type="button" variant="outline" aria-label={`${rotulo}: ${nome}`}>{rotulo}</Button></DialogTrigger>
    <DialogContent theme={tema} className={styles.dialogo}>
      <DialogHeader className={styles.cabecalho}><DialogTitle>{nome}</DialogTitle><DialogDescription>Confira as empresas e os filtros salvos nesta busca.</DialogDescription></DialogHeader>
      <div className={styles.corpo} aria-busy={carregando}>
        {carregando && <p role="status">Carregando busca…</p>}
        {erro && <div className="grid gap-3"><Alert variant="danger" role="alert">{erro}</Alert><Button type="button" variant="outline" onClick={() => void carregar()}>Tentar novamente</Button></div>}
        {conteudo}
      </div>
    </DialogContent>
  </Dialog>
}
