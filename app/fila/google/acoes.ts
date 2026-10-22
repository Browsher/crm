'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { validarPlano } from '@/src/features/google/regras'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { reservarEmpresa } from '@/src/features/fila/repositorio'

export type EstadoPlano = { erro: string | null; salvo: boolean }
export async function salvarPlanoAcao(_anterior: EstadoPlano, form: FormData): Promise<EstadoPlano> {
  const eu = await exigir('vendedor')
  const entrada = validarPlano(Object.fromEntries(form.entries()))
  if (!entrada.ok) return { erro: entrada.motivo, salvo: false }
  try {
    const r = await repositorioGoogle(eu.usuarioId).planejar(entrada.plano)
    if (!r.ok) return { erro: r.motivo, salvo: false }
    revalidatePath('/fila/google')
    revalidatePath('/fila/buscar')
    revalidatePath('/empresas/google')
    return { erro: null, salvo: true }
  } catch { return { erro: 'Não foi possível salvar. Confira o planejamento antes de tentar novamente.', salvo: false } }
}
export async function prospectarGoogleAcao(_anterior: { erro: string | null }, form: FormData): Promise<{ erro: string | null }> {
  const eu = await exigir('vendedor')
  const pedido = String(form.get('pedido') ?? '')
  const empresa = String(form.get('empresa') ?? '')
  const contexto = String(form.get('contexto') ?? '') || null
  if (contexto && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(contexto)) return { erro: 'Atualize a página antes de prospectar.' }
  const entrega = await repositorioGoogle(eu.usuarioId).detalhe(pedido)
  if (!entrega?.resultados.some(r => r.situacao === 'entregue' && r.empresa_id === empresa)) return { erro: 'Esta empresa não está disponível na sua entrega.' }
  const r = await reservarEmpresa(eu.usuarioId, empresa, { grupo: null, nome: '', cnae: null, uf: null, cidade: null, bairro: null }, contexto)
  if (!r.ok || r.resultado !== 'ok') return { erro: 'A disponibilidade mudou. Atualize a página ou continue seu atendimento atual.' }
  revalidatePath('/fila')
  redirect('/fila')
}
