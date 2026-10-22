type Recibo = Record<string, unknown>
export type ComandoGoogle = { acao: 'proximo' } | { acao: 'etapa'; pedido: string; estado: 'coletando' | 'validando' | 'falhou'; motivo: string | null }
  | { acao: 'entregar'; pedido: string; empresas: Record<string, unknown>[]; recibo: Recibo }
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
    if (!objeto(valor)) return { ok: false, status: 400 }
    if (valor.acao === 'proximo' && Object.keys(valor).length === 1) return { ok: true, comando: { acao: 'proximo' } }
    if (!uuid(valor.pedido)) return { ok: false, status: 400 }
    if (valor.acao === 'etapa' && Object.keys(valor).every(k => ['acao', 'pedido', 'estado', 'motivo'].includes(k))
      && ['coletando', 'validando', 'falhou'].includes(String(valor.estado))
      && (valor.motivo === undefined || valor.motivo === null || (typeof valor.motivo === 'string' && valor.motivo.length <= 500 && !/[\u0000-\u001f]/.test(valor.motivo)))) {
      return { ok: true, comando: { acao: 'etapa', pedido: valor.pedido, estado: valor.estado as 'coletando' | 'validando' | 'falhou', motivo: typeof valor.motivo === 'string' ? valor.motivo : null } }
    }
    if (valor.acao !== 'entregar' || Object.keys(valor).some(k => !['acao', 'pedido', 'empresas', 'recibo'].includes(k))
      || !Array.isArray(valor.empresas) || valor.empresas.length > 5000 || !valor.empresas.every(objeto) || !objeto(valor.recibo)) return { ok: false, status: 400 }
    const recibo = valor.recibo
    if (recibo.pedido_id !== valor.pedido || recibo.validacao_conferida !== true
      || !['origem_sha256', 'final_sha256'].every(k => typeof recibo[k] === 'string' && /^[0-9a-f]{64}$/.test(recibo[k] as string))
      || !['arquivo_original_id', 'arquivo_final_id'].every(k => typeof recibo[k] === 'string' && (recibo[k] as string).length > 0 && (recibo[k] as string).length <= 255)
      || JSON.stringify(valor).includes('\\u0000')) return { ok: false, status: 400 }
    return { ok: true, comando: { acao: 'entregar', pedido: valor.pedido, empresas: valor.empresas, recibo } }
  } catch { return { ok: false, status: 400 } }
  finally { leitor.releaseLock() }
}
