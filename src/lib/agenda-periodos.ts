export type PeriodoAgenda = '' | 'amanha' | 'semana_que_vem' | 'mes_que_vem'

export function dataCivilSaoPaulo(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora)
  const parte = (tipo: string) => partes.find(p => p.type === tipo)!.value
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

function civil(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function limitesPeriodoAgenda(hoje: string, periodo: PeriodoAgenda): { inicio: string; fim: string | null } {
  // Meio-dia UTC e operações UTC evitam depender do fuso do servidor ou de horário de verão.
  const data = new Date(`${hoje}T12:00:00.000Z`)
  if (periodo === 'mes_que_vem') {
    const inicio = new Date(data)
    inicio.setUTCMonth(inicio.getUTCMonth() + 1, 1)
    const fim = new Date(inicio)
    fim.setUTCMonth(fim.getUTCMonth() + 1, 0)
    return { inicio: civil(inicio), fim: civil(fim) }
  }
  if (periodo === 'semana_que_vem') {
    // Segunda é 0 e domingo é 6: a próxima semana sempre começa na segunda seguinte.
    const diaDaSemana = (data.getUTCDay() + 6) % 7
    data.setUTCDate(data.getUTCDate() + 7 - diaDaSemana)
    const inicio = civil(data)
    data.setUTCDate(data.getUTCDate() + 6)
    return { inicio, fim: civil(data) }
  }
  data.setUTCDate(data.getUTCDate() + 1)
  return { inicio: civil(data), fim: periodo === 'amanha' ? civil(data) : null }
}
