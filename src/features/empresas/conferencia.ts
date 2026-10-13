import { createHmac, timingSafeEqual } from 'node:crypto'
import type { OperacaoGrupo } from './repositorio'
import type { Conferencia } from './servico'

export type ContextoConferencia = { usuarioId: string; operacao: OperacaoGrupo }
const MOTIVOS = new Set(['identificadores_divergentes', 'cnpj_divergente', 'razao_social_divergente'])

type ConfiguracaoConferencia = { IMPORTACAO_CONFERENCIA_SEGREDO?: string }

function segredo(env: ConfiguracaoConferencia): Buffer | null {
  const chave = env.IMPORTACAO_CONFERENCIA_SEGREDO
  return chave && /^[0-9a-f]{64}$/i.test(chave) ? Buffer.from(chave, 'hex') : null
}
function assinar(chave: Buffer, contexto: ContextoConferencia, payload: string): string {
  // Contexto inclui toda a operação: campos futuros podem ser vinculados sem
  // alterar o envelope versionado. Nenhum dado recebido substitui o contexto.
  return createHmac('sha256', chave).update(JSON.stringify(['importacao-conferencia', 1, contexto, payload])).digest('hex')
}

export function emitirConferencia(contexto: ContextoConferencia, conferencia: Conferencia, env: ConfiguracaoConferencia = { IMPORTACAO_CONFERENCIA_SEGREDO: process.env.IMPORTACAO_CONFERENCIA_SEGREDO }): string | null {
  const chave = segredo(env)
  if (chave === null) return null
  const payload = Buffer.from(JSON.stringify({ versao: 1, ...conferencia })).toString('base64url')
  return `${payload}.${assinar(chave, contexto, payload)}`
}

export function verificarConferencia(comprovante: unknown, contexto: ContextoConferencia, env: ConfiguracaoConferencia = { IMPORTACAO_CONFERENCIA_SEGREDO: process.env.IMPORTACAO_CONFERENCIA_SEGREDO }): Conferencia | null {
  const chave = segredo(env)
  if (chave === null || typeof comprovante !== 'string' || comprovante.length > 600_000) return null
  const partes = /^([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/.exec(comprovante)
  if (!partes || !timingSafeEqual(Buffer.from(partes[2], 'hex'), Buffer.from(assinar(chave, contexto, partes[1]), 'hex'))) return null
  let dados: unknown
  try { dados = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')) } catch { return null }
  if (typeof dados !== 'object' || dados === null) return null
  const c = dados as { versao?: unknown; linhasAceitas?: unknown; recusadasIdentidade?: unknown }
  if (c.versao !== 1 || !Array.isArray(c.linhasAceitas) || !Array.isArray(c.recusadasIdentidade)
    || c.linhasAceitas.length + c.recusadasIdentidade.length > 5000) return null
  const numeros = [...c.linhasAceitas]
  for (const r of c.recusadasIdentidade) {
    if (typeof r !== 'object' || r === null || r.tipo !== 'identidade' || !MOTIVOS.has(r.motivo)) return null
    numeros.push(r.linha)
  }
  if (numeros.some(n => !Number.isSafeInteger(n) || n < 2) || new Set(numeros).size !== numeros.length) return null
  return { linhasAceitas: c.linhasAceitas as number[], recusadasIdentidade: c.recusadasIdentidade as Conferencia['recusadasIdentidade'] }
}
