'use server'
import type { DestinoContato, LeituraDestino } from '../../lib/pos-registro'
import { lerDestinoContato } from '../../server/atendimento/pos-registro'
import { revalidatePath } from 'next/cache'
import { exigir } from '../../server/autenticacao/guarda'
import { lerAtendimento } from '../../server/atendimento/consulta'
import { validarContatoDireto } from './regras'
import { registrarContato } from './repositorio'
import { textoDaFalta, textoDoMotivo } from './mensagens'

export type EstadoContato =
  | { ok: false; erro: string | null; motivo?: string; repetida?: never; leituraDestino?: never; aviso?: never }
  | { ok: true; erro: null; repetida: boolean; motivo?: never; leituraDestino: LeituraDestino<DestinoContato>; aviso?: string }

export async function prepararContatoAcao(empresaId: string) {
  const eu = await exigir('vendedor')
  return lerAtendimento(eu.usuarioId, empresaId)
}

export async function registrarContatoAcao(_anterior: EstadoContato, form: FormData): Promise<EstadoContato> {
  const eu = await exigir('vendedor')
  const empresaId = String(form.get('id') ?? '')
  // A RPC resolve replay antes da fase/versão atuais. Aqui só há estrutura;
  // uma fase nova não pode impedir a confirmação de um contato anterior.
  const r = validarContatoDireto({ tipo: String(form.get('tipo') ?? ''), nota: String(form.get('nota') ?? ''), proximoPasso: String(form.get('proximoPasso') ?? ''), proximoPassoData: String(form.get('proximoPassoData') ?? '') }, 'estrutura')
  if (!r.ok) return { ok: false, erro: textoDaFalta(r.falta), motivo: 'dados_invalidos' }
  const gravado = await registrarContato(eu.usuarioId, { empresaId, chave: String(form.get('chave') ?? ''), versao: Number(form.get('versao')) }, r.valor)
  if (!gravado.ok) return { ok: false, erro: textoDoMotivo(gravado.motivo), motivo: gravado.motivo }
  let leituraDestino: LeituraDestino<DestinoContato>
  try { leituraDestino = await lerDestinoContato(eu.usuarioId, empresaId, r.valor.tipo) }
  catch { leituraDestino = { ok: false, motivo: 'leitura_indisponivel' } }
  let aviso: string | undefined
  try {
    for (const caminho of ['/funil', '/fila', '/fila/localizar', '/fila/atendimento/' + empresaId, '/carteira', '/carteira/' + empresaId, '/meu-dia']) revalidatePath(caminho)
  } catch { aviso = 'Atendimento registrado. Atualize a página para conferir os dados.' }
  return { erro: null, ok: true, repetida: gravado.repetida, leituraDestino, ...(aviso ? { aviso } : {}) }
}
