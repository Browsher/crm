export function dataPlanejadaDaRotina(agora: Date): string | null {
  if (!Number.isFinite(agora.valueOf())) return null
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora)
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  const data = new Date(`${parte('year')}-${parte('month')}-${parte('day')}T12:00:00Z`)
  const dia = data.getUTCDay()
  if (dia === 0 || dia === 6 || Number(parte('hour')) < 17) return null
  data.setUTCDate(data.getUTCDate() + (dia === 5 ? 3 : 1))
  return data.toISOString().slice(0, 10)
}
