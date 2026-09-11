'use client'
import { useActionState, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { rascunhoAlterado } from '@/src/features/contato/rascunho'
import { agirNaFilaAcao, type EstadoFila } from '../acoes'
import { CamposReserva } from '../campos-reserva'
import { useRascunhos } from '../rascunhos'
import { urlConsulta } from './navegacao'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog'
import { useTemaFila } from '../tema'

const INICIAL: EstadoFila = { erro:null,filaVazia:false }
export function Reservar({ empresaId, contexto, filtros, empresaAtual }: {
  empresaId: string | null; contexto: string | null; filtros: Filtros; empresaAtual: string | null
}) {
  const router = useRouter()
  const rascunhos = useRascunhos()
  const tema = useTemaFila()
  const [confirmando, setConfirmando] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)
  const submitter = useRef<HTMLButtonElement>(null)
  const confirmada = useRef(false)
  const [estado,agir,pendente] = useActionState(async (anterior: EstadoFila,form: FormData) => {
    rascunhos.setGravando(true)
    try {
      const r = await agirNaFilaAcao(anterior,form)
      if (r.resultado === 'ok') {
        if (empresaAtual && empresaAtual !== r.empresaId) rascunhos.limpar(empresaAtual)
        router.push(urlConsulta(filtros,1).replace('/fila/localizar?', '/fila?'))
      }
      return r
    } finally { rascunhos.setGravando(false) }
  },INICIAL)
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (rascunhos.gravando || pendente) { e.preventDefault(); return }
    const draft = empresaAtual ? rascunhos.entradas[empresaAtual]?.valor : null
    if (!confirmada.current && empresaAtual !== empresaId && draft && rascunhoAlterado(draft)) {
      e.preventDefault()
      submitter.current = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      setConfirmando(true)
      return
    }
    confirmada.current = false
  }
  const acao = empresaId === null ? 'puxar' : 'reservar'
  const rotulo = empresaId === null ? 'Buscar cliente' : 'Reservar para ligar'
  return <>
    <form ref={formulario} action={agir} onSubmit={aoEnviar}>
      <CamposReserva filtros={filtros} contexto={contexto} />
      {empresaId !== null && <input type="hidden" name="empresaId" value={empresaId} />}
      {estado.erro && <p role="alert" className="mb-2 text-sm">{estado.erro}</p>}
      <Button type="submit" name="acao" value={acao} disabled={pendente || rascunhos.gravando} aria-busy={pendente}>
        {pendente ? (acao === 'puxar' ? 'Buscando cliente…' : 'Reservando…') : rotulo}
      </Button>
    </form>
    <Dialog open={confirmando} onOpenChange={setConfirmando}>
      <DialogContent theme={tema}>
        <DialogHeader>
          <DialogTitle>Trocar de empresa e descartar as anotações?</DialogTitle>
          <DialogDescription>As anotações não salvas da empresa atual serão descartadas se você continuar.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" onClick={() => {
            setConfirmando(false)
            confirmada.current = true
            formulario.current?.requestSubmit(submitter.current ?? undefined)
          }}>Descartar e continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
