'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import type { Filtros } from '@/src/features/prospeccao/tipos'
import { rascunhoAlterado } from '@/src/features/contato/rascunho'
import { agirNaFilaAcao, type EstadoFila } from '../acoes'
import { CamposReserva } from '../campos-reserva'
import { useRascunhos } from '../rascunhos'
import { urlConsulta } from './navegacao'

const INICIAL: EstadoFila = { erro:null,filaVazia:false }
export function Reservar({ empresaId, contexto, filtros, empresaAtual }: {
  empresaId: string; contexto: string | null; filtros: Filtros; empresaAtual: string | null
}) {
  const router = useRouter()
  const rascunhos = useRascunhos()
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
  return <form action={agir} onSubmit={e => {
    if (rascunhos.gravando || pendente) { e.preventDefault(); return }
    const draft = empresaAtual ? rascunhos.entradas[empresaAtual]?.valor : null
    if (empresaAtual !== empresaId && draft && rascunhoAlterado(draft) && !window.confirm('Trocar de empresa e descartar as anotações não salvas?')) e.preventDefault()
  }}>
    <CamposReserva filtros={filtros} contexto={contexto} />
    <input type="hidden" name="empresaId" value={empresaId} />
    {estado.erro && <p role="alert" className="mb-2 text-sm">{estado.erro}</p>}
    <button type="submit" name="acao" value="reservar" disabled={pendente || rascunhos.gravando} className="rounded border px-3 py-2 text-sm">
      {pendente ? 'Reservando…' : 'Reservar para ligar'}
    </button>
  </form>
}
