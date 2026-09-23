import { telefoneDoJid } from '@/src/lib/whatsapp-identificacao'
import { descreverMidia, type Midia } from '@/src/lib/whatsapp-midia'
import type { CadastroWhatsApp } from '@/src/lib/whatsapp-empresa'

export type Mensagem = {
  fonteId?: string
  vendedor?: string
  id: string
  conversa: string
  nome: string | null
  telefone?: string | null
  direcao: 'recebida' | 'enviada'
  texto: string
  em: string
  midia?: Midia
  cadastro?: CadastroWhatsApp
}

type Resultado = { configurado: boolean; total: number; mensagens: Mensagem[]; limiteHistorico: string; temMais: boolean }

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
  const midia = descreverMidia(registro?.message)
  return {
    id: chave.id,
    conversa: chave.remoteJid,
    telefone: telefoneDoJid(chave.remoteJid) ?? (chave.remoteJid.endsWith('@lid') ? telefoneDoJid(chave.remoteJidAlt) : null),
    nome: typeof registro?.pushName === 'string' && registro.pushName.trim() ? registro.pushName.trim() : null,
    direcao: chave.fromMe ? 'enviada' : 'recebida',
    texto: textoDe(registro?.message),
    em: data.toISOString(),
    ...(midia ? { midia } : {}),
  }
}

export async function lerMensagensRecentes(): Promise<Resultado> {
  return lerPaginaMensagens(1, new Date().toISOString())
}

export async function lerPaginaMensagens(pagina: number, limiteHistorico: string, instanciaResolvida?: string): Promise<Resultado> {
  const base = process.env.EVOLUTION_API_URL?.trim()
  const chave = process.env.EVOLUTION_API_KEY?.trim()
  const instancia = instanciaResolvida ?? process.env.EVOLUTION_INSTANCE_NAME?.trim()
  if (!base || !chave || !instancia) return { configurado: false, total: 0, mensagens: [], limiteHistorico, temMais: false }

  const url = new URL(base)
  if (url.protocol !== 'https:') throw new Error('A URL da Evolution deve usar HTTPS')
  const destino = new URL(`/chat/findMessages/${encodeURIComponent(instancia)}`, url)
  const resposta = await fetch(destino.toString(), {
    method: 'POST',
    headers: { apikey: chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: pagina, offset: 50, sort: 'desc', where: { messageTimestamp: { gte: '1970-01-01T00:00:00.000Z', lte: limiteHistorico } } }),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
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
    limiteHistorico,
    temMais: pagina * 50 < mensagens.total,
    mensagens: mensagens.records.map(reduzir).filter((item): item is Mensagem => item !== null),
  }
}
