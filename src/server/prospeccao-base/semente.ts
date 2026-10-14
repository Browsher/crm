import { consolidar } from '../../lib/prospeccao-base/consolidar'
import type { Base, ColetaEntrada, EstadoWhatsApp, FonteMaps } from '../../lib/prospeccao-base/modelo'

export type ResultadoSemente =
  | { ok: true; base: Base }
  | { ok: false; motivo: 'resultados_invalidos' | 'entrada_invalida'; detalhes: string[] }

type Medido = { telefone: string; estado: EstadoWhatsApp; jid: string | null; verificadoEm: string; statusHTTP: number | null }
function medido(valor: unknown): Medido | null {
  if (typeof valor !== 'object' || valor === null) return null
  const r = valor as Record<string, unknown>
  if (typeof r.telefone !== 'string' || !/^55[0-9]{10,11}$/.test(r.telefone) ||
    !['encontrado', 'nao_encontrado', 'inconclusivo'].includes(String(r.estado)) ||
    (r.jid !== null && typeof r.jid !== 'string') ||
    typeof r.verificadoEm !== 'string' || !r.verificadoEm.includes('T') || !Number.isFinite(Date.parse(r.verificadoEm)) ||
    (r.statusHTTP !== null && (!Number.isInteger(r.statusHTTP) || Number(r.statusHTTP) < 100 || Number(r.statusHTTP) > 599))) return null
  if (r.estado !== 'inconclusivo' && (typeof r.statusHTTP !== 'number' || r.statusHTTP < 200 || r.statusHTTP >= 300)) return null
  return r as Medido
}
export function prepararSemente(fontes: FonteMaps[], resultados: unknown, coleta: ColetaEntrada): ResultadoSemente {
  const dados = typeof resultados === 'object' && resultados !== null
    ? (resultados as Record<string, unknown>).resultados : null
  if (!Array.isArray(dados)) return { ok: false, motivo: 'resultados_invalidos', detalhes: ['Array de resultados ausente'] }
  const porNumero = new Map<string, Medido>()
  for (const valor of dados) {
    const r = medido(valor)
    if (!r || porNumero.has(r.telefone)) return { ok: false, motivo: 'resultados_invalidos', detalhes: ['Resultado inválido ou número repetido'] }
    porNumero.set(r.telefone, r)
  }
  const r = consolidar({ empresas: [], telefones: [], coletas: [] }, fontes, coleta)
  if (!r.ok) return { ok: false, motivo: 'entrada_invalida', detalhes: r.detalhes }
  r.base.telefones = r.base.telefones.map(t => {
    const consulta = porNumero.get(t.numero)
    return consulta ? { ...t, estado: consulta.estado, jid: consulta.jid, numeroRetornado: consulta.telefone,
      verificadoEm: consulta.verificadoEm, statusHTTP: consulta.statusHTTP, revalidar: false,
      motivo: consulta.estado === 'inconclusivo' ? 'consulta_inconclusiva' : null } : t
  })
  return { ok: true, base: r.base }
}
