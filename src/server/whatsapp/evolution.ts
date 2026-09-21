export type Mensagem = {
  id: string
  conversa: string
  nome: string | null
  direcao: 'recebida' | 'enviada'
  texto: string
  em: string
}

type Resultado = { configurado: boolean; total: number; mensagens: Mensagem[] }

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

function textoDe(valor: unknown): string {
  const conteudo = objeto(valor)
  if (!conteudo) return '[Conteúdo indisponível]'
  if (typeof conteudo.conversation === 'string') return conteudo.conversation
  const estendido = objeto(conteudo.extendedTextMessage)
  if (typeof estendido?.text === 'string') return estendido.text
  if (conteudo.imageMessage) return '[Imagem]'
  if (conteudo.audioMessage) return '[Áudio]'
  if (conteudo.documentMessage) return '[Documento]'
  if (conteudo.videoMessage) return '[Vídeo]'
  return '[Conteúdo indisponível]'
}

function reduzir(valor: unknown): Mensagem | null {
  const registro = objeto(valor)
  const chave = objeto(registro?.key)
  const timestamp = Number(registro?.messageTimestamp)
  if (!chave || typeof chave.id !== 'string' || typeof chave.remoteJid !== 'string' ||
    typeof chave.fromMe !== 'boolean' || !Number.isFinite(timestamp) || timestamp <= 0) return null

  const data = new Date(timestamp * 1000)
  if (Number.isNaN(data.getTime())) return null
  return {
    id: chave.id,
    conversa: chave.remoteJid,
    nome: typeof registro?.pushName === 'string' && registro.pushName.trim() ? registro.pushName.trim() : null,
    direcao: chave.fromMe ? 'enviada' : 'recebida',
    texto: textoDe(registro?.message),
    em: data.toISOString(),
  }
}

export async function lerMensagensRecentes(): Promise<Resultado> {
  const base = process.env.EVOLUTION_API_URL?.trim()
  const chave = process.env.EVOLUTION_API_KEY?.trim()
  const instancia = process.env.EVOLUTION_INSTANCE_NAME?.trim()
  if (!base || !chave || !instancia) return { configurado: false, total: 0, mensagens: [] }

  const url = new URL(base)
  if (url.protocol !== 'https:') throw new Error('A URL da Evolution deve usar HTTPS')
  const destino = new URL(`/chat/findMessages/${encodeURIComponent(instancia)}`, url)
  const resposta = await fetch(destino.toString(), {
    method: 'POST',
    headers: { apikey: chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: 1, offset: 50, sort: 'desc' }),
    cache: 'no-store',
  })
  if (!resposta.ok) throw new Error(`Falha ao consultar a Evolution (${resposta.status})`)
  const raiz = objeto(await resposta.json())
  const mensagens = objeto(raiz?.messages)
  if (!mensagens || !Array.isArray(mensagens.records) || typeof mensagens.total !== 'number') {
    throw new Error('Formato inesperado da resposta da Evolution')
  }
  return {
    configurado: true,
    total: mensagens.total,
    mensagens: mensagens.records.map(reduzir).filter((item): item is Mensagem => item !== null),
  }
}
