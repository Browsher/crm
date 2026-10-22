import type { ComandoGoogle } from './protocolo'

export function clienteAgente({ url, token, fetcher = fetch }: { url: string; token: string; fetcher?: typeof fetch }) {
  const base = new URL(url)
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use somente a origem do CRM, sem credenciais ou caminhos.')
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) throw new Error('Use HTTPS para acessar o CRM remoto.')
  return async (comando: ComandoGoogle): Promise<Record<string, unknown>> => {
    try {
      const r = await fetcher(new URL('/api/agente/google', base), { method: 'POST', headers: { Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json' }, body: JSON.stringify(comando), redirect: 'error', signal: AbortSignal.timeout(60_000) })
      if (!r.ok) throw new Error('HTTP recusado')
      const valor: unknown = await r.json()
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Resposta inválida')
      return valor as Record<string, unknown>
    } catch {
      throw new Error('Retorno não confirmado. Reconcilie o mesmo pedido antes de continuar; a chamada não foi repetida.')
    }
  }
}
