import { normalizarCriterios, verificacoesNecessarias, type CriteriosGoogle } from '@/src/lib/google/criterios'
import { regrasExigidas, type EvidenciaGoogle } from '@/src/lib/google/entrega'

export type ContextoVerificacoes = { pedido_id: string; execucao_id: string; lote_id: string; revisao: number; snapshot_sha256: string; criterios: CriteriosGoogle }
const objeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const incerto = () => new Error('Verificação não confirmada. Preserve o lote para reconciliação.')
const identidade = (c: Record<string, unknown>) => typeof c.google_place_id === 'string' && c.google_place_id ? c.google_place_id : typeof c.cnpj === 'string' && c.cnpj ? 'cnpj:' + c.cnpj : ''

export function configuracaoVerificacoes(env: Record<string, string | undefined> = process.env): {url: URL; token: string} {
  const token = env.GOOGLE_VERIFICACOES_TOKEN
  try {
    const url = new URL(env.GOOGLE_VERIFICACOES_URL ?? '')
    if (url.username || url.password || url.search || url.hash || !token || /[^\x21-\x7e]/.test(token)
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error()
    return {url,token}
  } catch { throw new Error('Verificação selecionada ainda não configurada pelo gestor.') }
}

export async function executarVerificacoes(contexto: ContextoVerificacoes, candidatas: Record<string, unknown>[], fetcher: typeof fetch = fetch, env: Record<string, string | undefined> = process.env): Promise<{ verificacoes_requeridas: ReturnType<typeof verificacoesNecessarias>; evidencias: EvidenciaGoogle[] }> {
  const normalizados = normalizarCriterios(contexto.criterios)
  if (!normalizados.ok) throw new Error('Critérios inválidos no snapshot da execução.')
  const criterios = normalizados.valor
  const verificacoes_requeridas = verificacoesNecessarias(criterios)
  if (!verificacoes_requeridas.length) return { verificacoes_requeridas, evidencias: [] }
  const {url,token} = configuracaoVerificacoes(env)
  try {
    if (candidatas.length < 1 || candidatas.length > 50 || candidatas.some(c => !identidade(c)) || new Set(candidatas.map(identidade)).size !== candidatas.length) throw incerto()
    const resposta = await fetcher(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...contexto, criterios, candidatas, verificacoes_requeridas }) })
    if (!resposta.ok || !resposta.body || Number(resposta.headers.get('content-length')) > 4000000) throw incerto()
    const leitor = resposta.body.getReader()
    const partes: Uint8Array[] = []
    let tamanho = 0
    try {
      while (true) {
        const { done, value } = await leitor.read()
        if (done) break
        tamanho += value.byteLength
        if (tamanho > 4000000) { await leitor.cancel(); throw incerto() }
        partes.push(value)
      }
    } finally { leitor.releaseLock() }
    const dados: unknown = JSON.parse(Buffer.concat(partes).toString('utf8'))
    return conferirRetornoVerificacoes(contexto, candidatas, dados)
  } catch { throw incerto() }
}

export function conferirRetornoVerificacoes(contexto: ContextoVerificacoes, candidatas: Record<string, unknown>[], dados: unknown): { verificacoes_requeridas: ReturnType<typeof verificacoesNecessarias>; evidencias: EvidenciaGoogle[] } {
  const normalizados = normalizarCriterios(contexto.criterios)
  if (!normalizados.ok) throw incerto()
  const criterios = normalizados.valor
  const verificacoes_requeridas = verificacoesNecessarias(criterios)
  if (!objeto(dados) || ['pedido_id', 'execucao_id', 'lote_id', 'revisao', 'snapshot_sha256'].some(k => dados[k] !== contexto[k as keyof ContextoVerificacoes])
    || !Array.isArray(dados.evidencias) || dados.evidencias.length > 1000) throw incerto()
  const regras = regrasExigidas(criterios)
  const vistas = new Set<string>()
  const evidencias: EvidenciaGoogle[] = []
  for (const ev of dados.evidencias) {
    if (!objeto(ev) || !['candidata', 'criterio', 'opcao', 'estado', 'motivo', 'fonte', 'horario'].every(k => typeof ev[k] === 'string')
      || !['aprovado', 'reprovado', 'nao_confirmado'].includes(String(ev.estado))
      || !String(ev.motivo).length || String(ev.motivo).length > 500 || !String(ev.fonte).length || String(ev.fonte).length > 2048
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(String(ev.horario)) || !Number.isFinite(Date.parse(String(ev.horario)))
      || !regras.some(r => r.criterio === ev.criterio && r.opcoes.includes(String(ev.opcao)))) throw incerto()
    const candidata = candidatas.find(c => identidade(c) === ev.candidata)
    const chave = JSON.stringify([ev.candidata, ev.criterio, ev.opcao])
    if (!candidata || vistas.has(chave)) throw incerto()
    vistas.add(chave)
    if (ev.criterio === 'telefone' && ev.estado === 'aprovado' && (ev.contato !== candidata.telefone || typeof ev.contato !== 'string' || !/^[0-9]{10,11}$/.test(ev.contato)
      || (ev.opcao === 'fixo' && !/^[0-9]{2}[2-5][0-9]{7}$/.test(ev.contato)))) throw incerto()
    evidencias.push(ev as unknown as EvidenciaGoogle)
  }
  return { verificacoes_requeridas, evidencias }
}
