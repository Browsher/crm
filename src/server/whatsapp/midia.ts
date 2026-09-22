import { descreverMidia, objeto } from '@/src/lib/whatsapp-midia'

const MAX_ARQUIVO = 20 * 1024 * 1024
const MAX_JSON = Math.ceil(MAX_ARQUIVO / 3) * 4 + 64 * 1024
type Resultado = { ok: true; bytes: Uint8Array; tipo: string; nome: string; documento: boolean }
  | { ok: false; motivo: 'nao_encontrada' | 'indisponivel' | 'muito_grande' }

class MuitoGrande extends Error {}

async function jsonLimitado(resposta: Response, limite: number): Promise<unknown> {
  if (Number(resposta.headers.get('content-length')) > limite) {
    await resposta.body?.cancel()
    throw new MuitoGrande()
  }
  if (!resposta.body) throw new Error('Resposta vazia')
  const leitor = resposta.body.getReader()
  const partes: Uint8Array[] = []
  let tamanho = 0
  try {
    while (true) {
      const { done, value } = await leitor.read()
      if (done) break
      tamanho += value.byteLength
      if (tamanho > limite) { await leitor.cancel(); throw new MuitoGrande() }
      partes.push(value)
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8'))
  } finally { leitor.releaseLock() }
}

export async function lerMidia(id: string, conversa: string, instanciaResolvida?: string): Promise<Resultado> {
  const base = process.env.EVOLUTION_API_URL?.trim()
  const chave = process.env.EVOLUTION_API_KEY?.trim()
  const instancia = instanciaResolvida ?? process.env.EVOLUTION_INSTANCE_NAME?.trim()
  if (!base || !chave || !instancia) return { ok: false, motivo: 'indisponivel' }
  try {
    const url = new URL(base)
    if (url.protocol !== 'https:') return { ok: false, motivo: 'indisponivel' }
    const consultar = async (metodo: string, body: unknown, limite: number) => {
      const resposta = await fetch(new URL(`/chat/${metodo}/${encodeURIComponent(instancia)}`, url).toString(), {
        method: 'POST', headers: { apikey: chave, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000),
      })
      if (!resposta.ok) { await resposta.body?.cancel(); throw new Error('Mídia indisponível') }
      return jsonLimitado(resposta, limite)
    }
    const busca = objeto(await consultar('findMessages', { where: { key: { id } }, page: 1, offset: 2 }, 1024 * 1024))
    const registros = objeto(busca?.messages)?.records
    if (!Array.isArray(registros) || registros.length !== 1) return { ok: false, motivo: 'nao_encontrada' }
    const registro = objeto(registros[0])
    const key = objeto(registro?.key)
    const descritor = descreverMidia(registro?.message)
    if (key?.id !== id || key?.remoteJid !== conversa || !descritor) return { ok: false, motivo: 'nao_encontrada' }
    const midia = objeto(await consultar('getBase64FromMediaMessage', { message: { key: { id } }, convertToMp4: false }, MAX_JSON))
    const tipo = typeof midia?.mimetype === 'string' ? midia.mimetype.split(';')[0].trim().toLowerCase() : ''
    if (descritor.tipo === 'imagem' && !/^image\/(jpeg|png|gif|webp)$/.test(tipo)) return { ok: false, motivo: 'indisponivel' }
    if (descritor.tipo === 'audio' && !/^audio\/(ogg|mpeg|mp4|aac|wav|x-wav|webm)$/.test(tipo)) return { ok: false, motivo: 'indisponivel' }
    const base64 = midia?.base64
    if (typeof base64 !== 'string' || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return { ok: false, motivo: 'indisponivel' }
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.byteLength > MAX_ARQUIVO) return { ok: false, motivo: 'muito_grande' }
    const nome = (descritor.nome ?? (typeof midia?.fileName === 'string' ? midia.fileName : 'arquivo'))
      .replace(/[\x00-\x1f\x7f/\\"<>:|?*\u202a-\u202e\u2066-\u2069]/g, '_').slice(0, 200) || 'arquivo'
    return { ok: true, bytes, tipo: descritor.tipo === 'documento' ? 'application/octet-stream' : tipo, nome, documento: descritor.tipo === 'documento' }
  } catch (erro) {
    return { ok: false, motivo: erro instanceof MuitoGrande ? 'muito_grande' : 'indisponivel' }
  }
}
