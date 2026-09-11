import { lerFiltros } from '@/src/features/prospeccao/filtros'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function lerEntradaReserva(form: FormData) {
  const acao = String(form.get('acao') ?? '')
  const alvo = acao === 'puxar' ? null : String(form.get('empresaId') ?? '')
  const contexto = String(form.get('contexto') ?? '') || null
  const params = Object.fromEntries(['nome','cnae','uf','cidade','bairro'].map(k => [k, String(form.get(k) ?? '')]))
  const consulta = lerFiltros(params)
  if (!['puxar','reservar','renovar'].includes(acao) || (alvo !== null && !UUID.test(alvo)) ||
      (contexto !== null && !UUID.test(contexto)) || !consulta.ok) return { ok: false as const }
  return { ok: true as const, alvo, contexto, filtros: consulta.filtros }
}
export function mensagemReserva(resultado: string): string {
  if (resultado === 'sem_candidata') return 'Nenhuma outra empresa disponível para estes filtros. Sua reserva atual foi mantida, se ainda estiver vigente.'
  if (resultado === 'contexto_alterado') return 'A reserva mudou em outra aba ou operação. Confira a empresa atual antes de tentar novamente. Suas anotações foram preservadas.'
  if (resultado === 'indisponivel') return 'Esta empresa está indisponível neste momento. Suas anotações foram preservadas.'
  return ''
}
