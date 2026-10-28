import { createHash, timingSafeEqual } from 'node:crypto'

export function autorizarAgente(authorization: string | null, config: { token?: string; usuarioId?: string }):
  { ok: true; usuarioId: string } | { ok: false; status: 401 | 503 } {
  if (!config.token || config.token.length < 32 || !config.usuarioId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(config.usuarioId)) return { ok: false, status: 503 }
  const recebido = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  const hash = (texto: string) => createHash('sha256').update(texto).digest()
  if (!timingSafeEqual(hash(recebido), hash(config.token))) return { ok: false, status: 401 }
  return { ok: true, usuarioId: config.usuarioId }
}
