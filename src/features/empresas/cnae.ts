export function normalizarCnae(bruto: string):
  { ok: true; valor: string | null } | { ok: false } {
  const v = bruto.trim()
  if (!v) return { ok: true, valor: null }
  if (!/^(?:[0-9]{7}|[0-9]{4}-[0-9]\/[0-9]{2})$/.test(v)) return { ok: false }
  return { ok: true, valor: v.replace(/[-/]/g, '') }
}
