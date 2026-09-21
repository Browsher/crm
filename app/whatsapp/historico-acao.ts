'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { lerPaginaMensagens, type Mensagem } from '@/src/server/whatsapp/evolution'

type ResultadoHistorico =
  | { ok: true; mensagens: Mensagem[]; temMais: boolean }
  | { ok: false; motivo: 'parametros_invalidos' | 'nao_configurado' | 'indisponivel' }

export async function historicoMensagensAcao(pagina: number, limiteHistorico: string): Promise<ResultadoHistorico> {
  await exigir('gestor')
  const timestamp = typeof limiteHistorico === 'string' ? Date.parse(limiteHistorico) : NaN
  if (!Number.isSafeInteger(pagina) || pagina < 2 || pagina > 100000 ||
    !Number.isFinite(timestamp) || timestamp < 0 || new Date(timestamp).toISOString() !== limiteHistorico) {
    return { ok: false, motivo: 'parametros_invalidos' }
  }
  try {
    const resultado = await lerPaginaMensagens(pagina, limiteHistorico)
    if (!resultado.configurado) return { ok: false, motivo: 'nao_configurado' }
    return { ok: true, mensagens: resultado.mensagens, temMais: resultado.temMais }
  } catch {
    return { ok: false, motivo: 'indisponivel' }
  }
}
