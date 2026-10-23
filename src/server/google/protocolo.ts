type Recibo = Record<string, unknown>
export type ComandoGoogle = ({ acao: 'proximo' } | { acao: 'etapa'; pedido: string; estado: 'coletando' | 'validando' | 'falhou'; motivo: string | null }
  | { acao: 'reservar_lote'; pedido: string; lote: Record<string, unknown> }
  | { acao: 'concluir'; pedido: string; motivo: 'meta_atingida' | 'limite_lotes' | 'sem_novidades' | 'sem_resultados' }
  | { acao: 'entregar'; pedido: string; empresas: Record<string, unknown>[]; recibo: Recibo }) & { executor: string }
const objeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)

export async function lerComando(request: Request): Promise<{ ok: true; comando: ComandoGoogle } | { ok: false; status: number }> {
  const limite = 9_000_000
  if (Number(request.headers.get('content-length')) > limite) return { ok: false, status: 413 }
  const leitor = request.body?.getReader()
  if (!leitor) return { ok: false, status: 400 }
  const partes: Uint8Array[] = []
  let tamanho = 0
  try {
    while (true) {
      const { done, value } = await leitor.read()
      if (done) break
      tamanho += value.byteLength
      if (tamanho > limite) { await leitor.cancel(); return { ok: false, status: 413 } }
      partes.push(value)
    }
    const valor: unknown = JSON.parse(Buffer.concat(partes).toString('utf8'))
    if (!objeto(valor) || !uuid(valor.executor)) return { ok: false, status: 400 }
    const executor = valor.executor
    if (valor.acao === 'proximo' && Object.keys(valor).every(k => ['acao','executor'].includes(k))) return { ok: true, comando: { acao: 'proximo', executor } }
    if (!uuid(valor.pedido)) return { ok: false, status: 400 }
    if (valor.acao === 'reservar_lote' && Object.keys(valor).every(k => ['acao', 'pedido', 'executor', 'lote'].includes(k))
      && objeto(valor.lote) && uuid(valor.lote.lote_id) && Array.isArray(valor.lote.candidatas) && valor.lote.candidatas.length > 0 && valor.lote.candidatas.length <= 50 && valor.lote.candidatas.every(objeto)
      && Object.keys(valor.lote).every(k => ['lote_id', 'candidatas'].includes(k))) return { ok: true, comando: { acao: 'reservar_lote', pedido: valor.pedido, executor, lote: valor.lote } }
    if (valor.acao === 'concluir' && Object.keys(valor).every(k => ['acao', 'pedido', 'executor', 'motivo'].includes(k))
      && ['meta_atingida', 'limite_lotes', 'sem_novidades', 'sem_resultados'].includes(String(valor.motivo))) return { ok: true, comando: { acao: 'concluir', pedido: valor.pedido, executor, motivo: valor.motivo as 'sem_novidades' } }
    if (valor.acao === 'etapa' && Object.keys(valor).every(k => ['acao', 'pedido', 'estado', 'motivo', 'executor'].includes(k))
      && ['coletando', 'validando', 'falhou'].includes(String(valor.estado))
      && (valor.motivo === undefined || valor.motivo === null || (typeof valor.motivo === 'string' && valor.motivo.length <= 500 && !/[\u0000-\u001f]/.test(valor.motivo)))) {
      return { ok: true, comando: { acao: 'etapa', executor, pedido: valor.pedido, estado: valor.estado as 'coletando' | 'validando' | 'falhou', motivo: typeof valor.motivo === 'string' ? valor.motivo : null } }
    }
    if (valor.acao !== 'entregar' || Object.keys(valor).some(k => !['acao', 'pedido', 'empresas', 'recibo', 'executor'].includes(k))
      || !Array.isArray(valor.empresas) || valor.empresas.length > 5000 || !valor.empresas.every(objeto) || !objeto(valor.recibo)) return { ok: false, status: 400 }
    const recibo = valor.recibo
    if (recibo.versao === 2) {
      if (valor.empresas.length > 50 || recibo.pedido_id !== valor.pedido || !uuid(recibo.execucao_id) || !uuid(recibo.lote_id)
        || !Number.isSafeInteger(recibo.revisao) || Number(recibo.revisao) < 1
        || !['snapshot_sha256', 'origem_sha256', 'resultado_sha256'].every(k => typeof recibo[k] === 'string' && /^[0-9a-f]{64}$/.test(recibo[k] as string))
        || !['arquivo_original_id', 'arquivo_resultado_id'].every(k => typeof recibo[k] === 'string' && /^[^\u0000-\u001f\u007f]{1,255}$/.test(recibo[k] as string))
        || !Array.isArray(recibo.verificacoes_requeridas) || recibo.verificacoes_requeridas.length > 5 || recibo.verificacoes_requeridas.some(v => !['dados_google', 'presenca_digital', 'perfil_comercial', 'whatsapp', 'fixo'].includes(String(v)))
        || !Array.isArray(recibo.evidencias) || recibo.evidencias.length > 1000 || !recibo.evidencias.every(objeto) || JSON.stringify(valor).includes('\\u0000')) return { ok: false, status: 400 }
      return { ok: true, comando: { acao: 'entregar', pedido: valor.pedido, executor, empresas: valor.empresas, recibo } }
    }
    if (recibo.pedido_id !== valor.pedido || recibo.validacao_conferida !== true
      || !['origem_sha256', 'final_sha256'].every(k => typeof recibo[k] === 'string' && /^[0-9a-f]{64}$/.test(recibo[k] as string))
      || !['arquivo_original_id', 'arquivo_final_id'].every(k => typeof recibo[k] === 'string' && (recibo[k] as string).length > 0 && (recibo[k] as string).length <= 255)
      || JSON.stringify(valor).includes('\\u0000')) return { ok: false, status: 400 }
    return { ok: true, comando: { acao: 'entregar', executor, pedido: valor.pedido, empresas: valor.empresas, recibo } }
  } catch { return { ok: false, status: 400 } }
  finally { leitor.releaseLock() }
}
