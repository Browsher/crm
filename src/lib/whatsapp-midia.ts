export type Midia = { tipo: 'imagem' | 'audio' | 'documento'; nome?: string; legenda?: string }

export function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : null
}

export function descreverMidia(valor: unknown): Midia | null {
  const raiz = objeto(valor)
  const conteudo = objeto(objeto(raiz?.documentWithCaptionMessage)?.message) ?? raiz
  if (!conteudo) return null
  for (const [campo, tipo] of [['imageMessage', 'imagem'], ['audioMessage', 'audio'], ['documentMessage', 'documento']] as const) {
    const item = objeto(conteudo[campo])
    if (!item) continue
    return {
      tipo,
      ...(typeof item.fileName === 'string' ? { nome: item.fileName.slice(0, 200) } : {}),
      ...(typeof item.caption === 'string' ? { legenda: item.caption.slice(0, 4096) } : {}),
    }
  }
  return null
}
