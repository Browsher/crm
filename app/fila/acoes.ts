'use server'

import { revalidatePath } from 'next/cache'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { reservarEmpresa } from '@/src/features/fila/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerEntradaReserva, mensagemReserva } from './entrada-reserva'

export type EstadoFila = { erro: string | null; filaVazia: boolean; resultado?: string; empresaId?: string | null }

export async function agirNaFilaAcao(_anterior: EstadoFila, form: FormData): Promise<EstadoFila> {
  const eu = await exigir('usuario')
  const entrada = lerEntradaReserva(form)
  if (!entrada.ok) return { erro: 'Ação ou filtros inválidos. Confira os dados e tente novamente.', filaVazia: false }
  const r = await reservarEmpresa(eu.usuarioId, entrada.alvo, entrada.filtros, entrada.contexto)
  if (!r.ok) return { erro: textoDoMotivo(r.motivo), filaVazia: false }
  revalidatePath('/fila')
  revalidatePath('/fila/localizar')
  return { erro: mensagemReserva(r.resultado) || null, filaVazia: r.resultado === 'sem_candidata', resultado: r.resultado, empresaId: r.empresaId }
}
