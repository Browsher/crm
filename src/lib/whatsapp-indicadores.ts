type MensagemIndicador = { id: string; conversa: string; fonteId?: string; direcao: 'recebida' | 'enviada'; em: string }
export type IndicadoresWhatsApp = { conversasHoje: number; semResposta: number; ativosHoje: number; vendedores: number; mediaMinutos: number | null }

const dataLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const horaLocal = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
const hora = 3_600_000
const dia = 24 * hora

function minutosUteis(inicio: number, fim: number) {
  let soma = 0
  const ultimoDia = Date.parse(`${dataLocal.format(fim)}T00:00:00Z`)
  for (let atual = Date.parse(`${dataLocal.format(inicio)}T00:00:00Z`); atual <= ultimoDia; atual += dia) {
    const semana = new Date(atual).getUTCDay()
    if (semana === 0 || semana === 6) continue
    // Offset do próprio dia, inclusive para histórico anterior ao fim do horário de verão.
    const offset = Number(horaLocal.format(atual + 12 * hora)) - 12
    const abre = atual + (9 - offset) * hora
    const fecha = atual + (18 - offset) * hora
    soma += Math.max(0, Math.min(fim, fecha) - Math.max(inicio, abre))
  }
  return soma / 60_000
}

export function calcularIndicadores(mensagens: MensagemIndicador[], fontes: string[], referencia: string): IndicadoresWhatsApp {
  const agora = Date.parse(referencia)
  const hoje = dataLocal.format(agora)
  const vendedores = new Set(fontes.filter(id => id !== 'piloto'))
  const conversasHoje = new Set<string>()
  const ativos = new Set<string>()
  const conversas = new Map<string, { pendente: number | null; ultima: 'recebida' | 'enviada' }>()
  const unicas = new Map(mensagens.map(m => [JSON.stringify([m.fonteId, m.conversa, m.id]), m]))
  const ordenadas = [...unicas.values()].map(m => ({ ...m, tempo: Date.parse(m.em) }))
    .filter(m => Number.isFinite(m.tempo) && m.tempo <= agora && !m.conversa.endsWith('@g.us') && !m.conversa.endsWith('@broadcast'))
    .sort((a, b) => a.tempo - b.tempo)
  let soma = 0
  let respostas = 0
  for (const m of ordenadas) {
    const id = JSON.stringify([m.fonteId, m.conversa])
    const conversa = conversas.get(id) ?? { pendente: null, ultima: m.direcao }
    const deHoje = dataLocal.format(m.tempo) === hoje
    if (deHoje) conversasHoje.add(id)
    if (m.direcao === 'recebida') conversa.pendente ??= m.tempo
    else {
      if (deHoje && m.fonteId && vendedores.has(m.fonteId)) ativos.add(m.fonteId)
      if (deHoje && conversa.pendente !== null) {
        soma += minutosUteis(conversa.pendente, m.tempo)
        respostas += 1
      }
      conversa.pendente = null
    }
    conversa.ultima = m.direcao
    conversas.set(id, conversa)
  }
  return { conversasHoje: conversasHoje.size, semResposta: [...conversas.values()].filter(c => c.ultima === 'recebida').length,
    ativosHoje: ativos.size, vendedores: vendedores.size, mediaMinutos: respostas ? soma / respostas : null }
}
