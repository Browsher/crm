export type NumeroNormalizado =
  | { ok: true; numero: string; tipo: 'fixo' | 'celular' }
  | { ok: false; motivo: 'telefone_ausente' | 'ddd_ausente' | 'telefone_invalido' }

export function normalizarNumero(bruto: string): NumeroNormalizado {
  const texto = bruto.trim()
  if (!texto) return { ok: false, motivo: 'telefone_ausente' }
  const limpo = texto.replace(/[\s().-]/g, '').replace(/^\+/, '')
  if (/^[0-9]{8,9}$/.test(limpo)) return { ok: false, motivo: 'ddd_ausente' }
  const nacional = /^55[0-9]{10,11}$/.test(limpo) ? limpo.slice(2) : limpo
  if (!/^[0-9]{10,11}$/.test(nacional)) return { ok: false, motivo: 'telefone_invalido' }
  return { ok: true, numero: '55' + nacional, tipo: nacional.length === 10 ? 'fixo' : 'celular' }
}
