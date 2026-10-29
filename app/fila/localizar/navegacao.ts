import type { Filtros } from '@/src/features/prospeccao/tipos'
import { CAMPOS_PESSOAIS, lerFiltrosPessoais, urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'

export function filtrosDaConsulta(params: Record<string, string | string[] | undefined>): FiltrosPessoais {
  let bruto: unknown = Object.fromEntries(CAMPOS_PESSOAIS.filter(k => params[k] !== undefined).map(k => [k, params[k]]))
  if (typeof params.pessoal === 'string') { try { bruto = JSON.parse(params.pessoal) } catch { return {} } }
  const r = lerFiltrosPessoais(bruto)
  return r.ok ? r.filtros : {}
}
export function urlAtendimento(empresaId: string, filtros: FiltrosPessoais): string {
  return urlPessoal(filtros, Number(filtros.pagina || 1)).replace('/fila/localizar', `/fila/atendimento/${encodeURIComponent(empresaId)}`)
}

export function urlConsulta(filtros: Filtros, pagina: number): string {
  const params = new URLSearchParams()
  for (const campo of ['nome', 'cnae', 'uf', 'cidade', 'bairro'] as const) {
    if (filtros[campo]) params.set(campo, filtros[campo])
  }
  params.set('pagina', String(pagina))
  if(filtros.pessoal) return urlPessoal(filtrosDaConsulta({ pessoal: filtros.pessoal }), pagina)
  return `/fila/localizar?${params}`
}

export function selecionarGrupo(grupo: string | null): Filtros {
  return { nome:'', cnae:null, uf:null, cidade:null, bairro:null, pagina:1, grupo }
}

export function limparFiltros(filtros: Filtros): Filtros {
  return selecionarGrupo(filtros.grupo)
}

export function urlEscolhaLista(filtros: Filtros, atendimento = false, aberta = true): string {
  void atendimento; void aberta
  return urlConsulta(filtros, filtros.pagina)
}
