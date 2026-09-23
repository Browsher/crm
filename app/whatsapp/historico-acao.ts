'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { lerPaginaMensagens, type Mensagem } from '@/src/server/whatsapp/evolution'
import { consultarFontes, resolverFontes, type Cursores } from '@/src/server/whatsapp/consulta'

type ResultadoHistorico =
  | { ok: true; mensagens: Mensagem[]; temMais: boolean; cursores?: Cursores; avisos?: string[] }
  | { ok: false; motivo: 'parametros_invalidos' | 'nao_configurado' | 'indisponivel' }

export async function historicoMensagensAcao(pagina: number, limiteHistorico: string): Promise<ResultadoHistorico> {
  const eu = await exigir('gestor')
  const timestamp = typeof limiteHistorico === 'string' ? Date.parse(limiteHistorico) : NaN
  if (!Number.isSafeInteger(pagina) || pagina < 2 || pagina > 100000 ||
    !Number.isFinite(timestamp) || timestamp < 0 || new Date(timestamp).toISOString() !== limiteHistorico) {
    return { ok: false, motivo: 'parametros_invalidos' }
  }
  try {
    const { fontes } = await resolverFontes(eu.usuarioId, 'piloto')
    if (!fontes.length) return { ok: false, motivo: 'nao_configurado' }
    const resultado = await lerPaginaMensagens(pagina, limiteHistorico, fontes[0].instancia)
    if (!resultado.configurado) return { ok: false, motivo: 'nao_configurado' }
    return { ok: true, mensagens: resultado.mensagens, temMais: resultado.temMais }
  } catch {
    return { ok: false, motivo: 'indisponivel' }
  }
}

export async function historicoFontesAcao(filtro: string, cursores: Cursores): Promise<ResultadoHistorico> {
  const eu = await exigir('gestor')
  if (typeof filtro !== 'string' || filtro.length > 100 || !cursores) return { ok: false as const, motivo: 'parametros_invalidos' }
  try {
    const r = await consultarFontes(eu.usuarioId, filtro, cursores)
    return { ok: true as const, mensagens: r.mensagens, cursores: r.cursores, avisos: r.avisos, temMais: r.temMais }
  } catch { return { ok: false as const, motivo: 'indisponivel' } }
}
