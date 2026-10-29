import type { WorkflowExport } from './workflow'

export type ConfigInstalacao = {
  baseUrl: string; apiKey: string; workflowId: string; projectId: string
  guardarAnterior: (anterior: Record<string, unknown>) => Promise<void>
}
export type ResultadoInstalacao = { ok: true; workflowId: string } | {
  ok: false; motivo: 'sem_acesso' | 'alvo_divergente' | 'alvo_ativo' | 'alteracao_concorrente' | 'verificacao_falhou'
}
function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function canonico(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']'
  if (objeto(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}'
  return JSON.stringify(v) ?? 'null'
}
function noProjeto(atual: Record<string, unknown>, projectId: string): boolean {
  return atual.projectId === projectId || (objeto(atual.project) && atual.project.id === projectId) ||
    (Array.isArray(atual.shared) && atual.shared.some(s => objeto(s) &&
      (s.projectId === projectId || (objeto(s.project) && s.project.id === projectId))))
}
export async function instalarAlvo(config: ConfigInstalacao, exportado: WorkflowExport, http: typeof fetch): Promise<ResultadoInstalacao> {
  if (config.workflowId !== 'NxCO8HiaJmwqJ8jK' || config.projectId !== 'mIsmhrUTAVI1ZPnf' ||
    config.baseUrl !== 'https://primary-production-04eb.up.railway.app') return { ok: false, motivo: 'alvo_divergente' }
  if (!config.apiKey.trim()) return { ok: false, motivo: 'sem_acesso' }
  const url = config.baseUrl + '/api/v1/workflows/' + config.workflowId
  const headers = { 'X-N8N-API-KEY': config.apiKey, 'Content-Type': 'application/json' }
  try {
    const primeira = await http(url, { headers, redirect: 'error' })
    if (primeira.status === 401 || primeira.status === 403) return { ok: false, motivo: 'sem_acesso' }
    if (!primeira.ok) return { ok: false, motivo: 'verificacao_falhou' }
    const atual: unknown = await primeira.json()
    if (!objeto(atual) || atual.id !== config.workflowId || !noProjeto(atual, config.projectId)) {
      return { ok: false, motivo: 'alvo_divergente' }
    }
    if (atual.active !== false) return { ok: false, motivo: 'alvo_ativo' }
    const segunda = await http(url, { headers, redirect: 'error' })
    if (!segunda.ok || canonico(await segunda.json()) !== canonico(atual)) return { ok: false, motivo: 'alteracao_concorrente' }
    await config.guardarAnterior(atual)
    const pedido = { name: typeof atual.name === 'string' ? atual.name : exportado.name,
      nodes: exportado.nodes, connections: exportado.connections,
      settings: { ...(objeto(atual.settings) ? atual.settings : {}), ...exportado.settings } }
    const gravar = await http(url, { method: 'PUT', headers, body: JSON.stringify(pedido), redirect: 'error' })
    if (!gravar.ok) return { ok: false, motivo: 'verificacao_falhou' }
    const reler = await http(url, { headers, redirect: 'error' })
    if (!reler.ok) return { ok: false, motivo: 'verificacao_falhou' }
    const final: unknown = await reler.json()
    if (!objeto(final) || final.id !== config.workflowId || final.active !== false || final.name !== pedido.name ||
      canonico(final.nodes) !== canonico(pedido.nodes) || canonico(final.connections) !== canonico(pedido.connections) ||
      !objeto(final.settings) || Object.keys(pedido.settings).some(k => canonico((final.settings as Record<string, unknown>)[k]) !== canonico(pedido.settings[k]))) {
      return { ok: false, motivo: 'verificacao_falhou' }
    }
    return { ok: true, workflowId: config.workflowId }
  } catch {
    return { ok: false, motivo: 'verificacao_falhou' }
  }
}
