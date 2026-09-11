'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { registrarRecente } from '@/src/features/prospeccao/recentes'

export async function registrarVisitaAcao(empresaId: string): Promise<{ erro: string | null }> {
  const eu = await exigir('usuario')
  if (typeof empresaId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) {
    return { erro: 'Empresa inválida. Não foi possível atualizar as empresas recentes.' }
  }
  const r = await registrarRecente(eu.usuarioId, empresaId)
  if (!r.ok || !r.registrado) return { erro: 'Não foi possível atualizar as empresas recentes.' }
  revalidatePath('/fila/localizar')
  return { erro: null }
}
