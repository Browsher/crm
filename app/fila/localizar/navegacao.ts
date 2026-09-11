import type { Filtros } from '@/src/features/prospeccao/tipos'

export function urlConsulta(filtros: Filtros, pagina: number): string {
  const params = new URLSearchParams()
  for (const campo of ['nome', 'cnae', 'uf', 'cidade', 'bairro'] as const) {
    if (filtros[campo]) params.set(campo, filtros[campo])
  }
  params.set('pagina', String(pagina))
  return `/fila/localizar?${params}`
}
