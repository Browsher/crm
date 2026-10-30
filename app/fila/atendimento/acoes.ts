'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { iniciarAtendimento, retomarAtendimento } from '@/src/server/atendimento/operacoes'
import type { ResultadoAtendimento } from '@/src/lib/atendimento'

export async function iniciarAtendimentoAcao(form: FormData): Promise<ResultadoAtendimento> {
  const eu = await exigir('vendedor')
  const resultado = await iniciarAtendimento(eu.usuarioId, { empresaId: String(form.get('id') ?? ''), chave: String(form.get('chave') ?? ''), versao: Number(form.get('versao')) })
  if (resultado.ok) { revalidatePath('/fila/localizar'); revalidatePath('/fila/atendimento', 'layout') }
  return resultado
}
export async function retomarAtendimentoAcao(form: FormData): Promise<ResultadoAtendimento> {
  const eu = await exigir('vendedor')
  const resultado = await retomarAtendimento(eu.usuarioId, { empresaId: String(form.get('id') ?? ''), chave: String(form.get('chave') ?? ''), versao: Number(form.get('versao')) })
  if (resultado.ok) { revalidatePath('/fila/localizar'); revalidatePath('/fila/atendimento', 'layout') }
  return resultado
}
