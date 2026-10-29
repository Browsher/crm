import { registrarContatoDireto } from '../../server/atendimento/operacoes'
import type { ComandoEmpresa, EntradaContato, ResultadoAtendimento } from '../../lib/atendimento'
export type Falha = Extract<ResultadoAtendimento, { ok: false }>
export function registrarContato(usuarioId: string, comando: ComandoEmpresa, entrada: EntradaContato): Promise<ResultadoAtendimento> {
  return registrarContatoDireto(usuarioId, comando, entrada)
}
