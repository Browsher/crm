import type { PlanoEntrada } from './tipos'
import { normalizarCriterios } from '@/src/lib/google/criterios'

export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}
export function semanaDe(data: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  const inicio = new Date(data + 'T12:00:00Z')
  if (!Number.isFinite(inicio.valueOf()) || inicio.toISOString().slice(0, 10) !== data) return null
  inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 6) % 7)
  return Array.from({ length: 5 }, (_, i) => {
    const dia = new Date(inicio)
    dia.setUTCDate(inicio.getUTCDate() + i)
    return dia.toISOString().slice(0, 10)
  })
}
export function proximosDiasUteis(data: string): string[] | null {
  if (!semanaDe(data)) return null
  const dia = new Date(data+'T12:00:00Z')
  const dias: string[] = []
  while (dias.length<5) {
    if (dia.getUTCDay()>0 && dia.getUTCDay()<6) dias.push(dia.toISOString().slice(0,10))
    dia.setUTCDate(dia.getUTCDate()+1)
  }
  return dias
}
export function validarPlano(entrada: Record<string, unknown>): { ok: true; plano: PlanoEntrada } | { ok: false; motivo: string } {
  const { dia, nicho, bairro, cidade, uf } = entrada
  if (typeof dia !== 'string' || !semanaDe(dia)?.includes(dia)) return { ok: false, motivo: 'Escolha uma data válida de segunda a sexta.' }
  if ([nicho, bairro, cidade, uf].some(v => typeof v !== 'string' || /[\u0000-\u001f\u007f-\u009f]/.test(v))) return { ok: false, motivo: 'Confira os critérios informados.' }
  const criterios = normalizarCriterios(entrada.criterios)
  if (!criterios.ok) return criterios
  const plano: PlanoEntrada = { dia, nicho: (nicho as string).trim(), bairro: (bairro as string).trim(), cidade: (cidade as string).trim(), uf: (uf as string).trim().toUpperCase(),
    ...(entrada.criterios !== undefined ? { criterios: criterios.valor } : {}) }
  if (![plano.nicho, plano.bairro, plano.cidade, plano.uf].some(Boolean)) return { ok: true, plano }
  if (!plano.nicho || plano.nicho.length > 100 || !plano.cidade || plano.cidade.length > 100 || plano.bairro.length > 100
    || !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(plano.uf)) {
    return { ok: false, motivo: 'Preencha nicho, cidade e UF. Use até 100 caracteres por campo.' }
  }
  return { ok: true, plano }
}
