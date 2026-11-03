'use server'

import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import { avisarSeRevalidacaoFalhar, RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'

export type EstadoLimite = { erro: string | null; salvo: boolean; incerto?: boolean; aviso?: string }
export async function salvarLimiteAcao(_anterior: EstadoLimite, form: FormData): Promise<EstadoLimite> {
  const eu = await exigir('gestor')
  const limite = String(form.get('limite') ?? '')
  if (!/^[0-9]{1,5}$/.test(limite)) return { erro: mensagemBusca('operacao_invalida'), salvo: false }
  const r = await repositorioBusca(eu.usuarioId)
    .definirLimite(String(form.get('usuario') ?? ''), Number(limite), form.get('pausado') === 'on').catch(() => null)
  if (!r) return { erro: RESULTADO_INCERTO, incerto: true, salvo: false }
  if (!r.ok) return { erro: mensagemBusca(r.motivo), salvo: false }
  return { erro: null, salvo: true, ...avisarSeRevalidacaoFalhar(() => {
    revalidatePath('/empresas/busca')
    revalidatePath('/fila/buscar')
  }) }
}
