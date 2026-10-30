import { ehTipo } from './tipos'
import type { EntradaContato } from '../../lib/atendimento'

export function validarContatoDireto(
  entrada: { tipo: string; nota: string; proximoPasso: string; proximoPassoData: string },
  fase: 'inicial' | 'negociacao' | 'cliente' | 'estrutura',
): { ok: true; valor: EntradaContato } | { ok: false; falta: string } {
  if (!ehTipo(entrada.tipo) || (entrada.tipo === 'acompanhamento' && fase === 'inicial')) {
    return { ok: false, falta: 'tipo_invalido' }
  }
  const nota = ouNulo(entrada.nota)
  const proximoPasso = ouNulo(entrada.proximoPasso)
  const proximoPassoData = ouNulo(entrada.proximoPassoData)
  if (entrada.tipo === 'sem_interesse' && (proximoPasso || proximoPassoData)) {
    return { ok: false, falta: 'agenda_incompativel' }
  }
  if ((proximoPasso === null) !== (proximoPassoData === null)) return { ok: false, falta: 'par_incompleto' }
  if ((entrada.tipo === 'retornar_depois' || entrada.tipo === 'acompanhamento') && !proximoPasso) {
    return { ok: false, falta: 'proximo_passo_exigido' }
  }
  if (proximoPassoData && (
    !/^\d{4}-\d{2}-\d{2}$/.test(proximoPassoData) || proximoPassoData < '0001-01-01'
    || Number.isNaN(Date.parse(proximoPassoData))
    || new Date(proximoPassoData).toISOString().slice(0, 10) !== proximoPassoData
  )) return { ok: false, falta: 'dados_invalidos' }
  if ((nota?.length ?? 0) > 2000 || (proximoPasso?.length ?? 0) > 2000) return { ok: false, falta: 'dados_invalidos' }
  return { ok: true, valor: { tipo: entrada.tipo, nota, proximoPasso, proximoPassoData } }
}


function ouNulo(v: string): string | null { return v.trim() || null }
