'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'

export async function definirAgenteAcao(_anterior: {erro:string|null}, form: FormData): Promise<{erro:string|null;sucesso?:boolean}> {
  const eu = await exigir('gestor')
  const id = String(form.get('vendedor')??'')
  const pausa = form.get('pausado')
  if (pausa !== 'true' && pausa !== 'false') return {erro:'Confira a ação do agente.'}
  try {
    const r = await repositorioGoogle(eu.usuarioId).definirAgente(id,pausa==='true')
    if (!r.ok) return {erro:r.motivo}
    revalidatePath('/empresas/google')
    revalidatePath('/fila/google')
    revalidatePath('/fila/buscar')
    return {erro:null,sucesso:true}
  } catch { return {erro:'Não foi possível atualizar. Confira a situação do agente antes de tentar novamente.'} }
}
