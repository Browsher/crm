export function telefoneDoJid(jid: unknown): string | null {
  if (typeof jid !== 'string' || !/^[1-9]\d{6,14}@s\.whatsapp\.net$/.test(jid)) return null
  return `+${jid.slice(0, -'@s.whatsapp.net'.length)}`
}
