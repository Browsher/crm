'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { historicoDaAgenda, type ResultadoAgendaHistorico } from './historico'

export async function historicoDaAgendaAcao(empresaId: string): Promise<ResultadoAgendaHistorico> {
  const eu = await exigir('usuario')
  if (typeof empresaId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(empresaId)) {
    return { ok: false, motivo: 'fora_da_carteira' }
  }
  return historicoDaAgenda(eu.usuarioId, empresaId)
}
