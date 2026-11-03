'use server'
import { revalidatePath } from 'next/cache'
import { exigir } from '@/src/server/autenticacao/guarda'
import { iniciarAtendimento, retomarAtendimento } from '@/src/server/atendimento/operacoes'
import { lerDestinoEmpresaAtual } from '@/src/server/atendimento/pos-registro'
import type { ResultadoAtendimento, ComandoEmpresa } from '@/src/lib/atendimento'
import type { DestinoEmpresaAtual, LeituraDestino } from '@/src/lib/pos-registro'

export type EstadoAcaoEmpresa = Exclude<ResultadoAtendimento, { ok: true }>
  | (Extract<ResultadoAtendimento, { ok: true }> & { leituraDestino: LeituraDestino<DestinoEmpresaAtual>; aviso?: string })
async function executar(form: FormData, operacao: (usuarioId: string, comando: ComandoEmpresa) => Promise<ResultadoAtendimento>): Promise<EstadoAcaoEmpresa> {
  const eu = await exigir('vendedor')
  const empresaId = String(form.get('id') ?? '')
  const resultado = await operacao(eu.usuarioId, { empresaId, chave: String(form.get('chave') ?? ''), versao: Number(form.get('versao')) })
  if (!resultado.ok) return resultado
  let leituraDestino: LeituraDestino<DestinoEmpresaAtual>
  try { leituraDestino = await lerDestinoEmpresaAtual(eu.usuarioId, empresaId) }
  catch { leituraDestino = { ok: false, motivo: 'leitura_indisponivel' } }
  let aviso: string | undefined
  try { revalidatePath('/fila/localizar'); revalidatePath('/fila/atendimento', 'layout') }
  catch { aviso = 'Envio confirmado. Atualize a página para conferir a situação atual.' }
  return { ...resultado, leituraDestino, ...(aviso ? { aviso } : {}) }
}
export async function iniciarAtendimentoAcao(form: FormData): Promise<EstadoAcaoEmpresa> {
  return executar(form, iniciarAtendimento)
}
export async function retomarAtendimentoAcao(form: FormData): Promise<EstadoAcaoEmpresa> {
  return executar(form, retomarAtendimento)
}
