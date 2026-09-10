'use server'

import { revalidatePath } from 'next/cache'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { puxarProxima } from '@/src/features/fila/repositorio'
import { exigir } from '@/src/server/autenticacao/guarda'

export type EstadoFila = { erro: string | null; filaVazia: boolean }

// Só `puxar` sobrou: assumir e devolver passaram a ser desfecho de
// `registrarContatoAcao`, em src/features/contato/acao.ts.
const ACOES: readonly string[] = ['puxar']

export async function agirNaFilaAcao(_anterior: EstadoFila, form: FormData): Promise<EstadoFila> {
  const eu = await exigir('usuario')
  const acao = String(form.get('acao') ?? '')
  if (!ACOES.includes(acao)) return { erro: 'Ação desconhecida.', filaVazia: false }

  if (acao === 'puxar') {
    const r = await puxarProxima(eu.usuarioId)
    if (!r.ok) return { erro: textoDoMotivo(r.motivo), filaVazia: false }
    revalidatePath('/fila')
    // Fila vazia não é erro: a função respondeu, e a resposta é "não há
    // candidata". A tela precisa dizer isso com outras palavras.
    return { erro: null, filaVazia: r.empresaId === null }
  }

  return { erro: 'Ação desconhecida.', filaVazia: false }
}
