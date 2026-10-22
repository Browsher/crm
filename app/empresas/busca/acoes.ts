'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'

export type EstadoLimite = { erro: string | null; salvo: boolean }
export async function salvarLimiteAcao(_anterior: EstadoLimite, form: FormData): Promise<EstadoLimite> {
  const eu = await exigir('gestor')
  const limite = String(form.get('limite') ?? '')
  if (!/^[0-9]{1,5}$/.test(limite)) return { erro: mensagemBusca('operacao_invalida'), salvo: false }
  try {
    const r = await repositorioBusca(eu.usuarioId).definirLimite(String(form.get('usuario') ?? ''), Number(limite), form.get('pausado') === 'on')
    if (!r.ok) return { erro: mensagemBusca(r.motivo), salvo: false }
    revalidatePath('/empresas/busca')
    revalidatePath('/fila/buscar')
    return { erro: null, salvo: true }
  } catch { return { erro: 'Não foi possível salvar o limite. Tente novamente.', salvo: false } }
}
