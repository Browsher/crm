import type { Filtros } from '@/src/features/prospeccao/tipos'
import { CAMPOS_PESSOAIS, lerFiltrosPessoais, urlPessoal, type FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'

export function lerConsultaPessoal(params: Record<string, string | string[] | undefined>, semInteresse = false): ReturnType<typeof lerFiltrosPessoais> {
  let bruto: unknown = Object.fromEntries(CAMPOS_PESSOAIS.filter(k => params[k] !== undefined).map(k => [k, params[k]]))
  if (params.pessoal !== undefined) {
    if (typeof params.pessoal !== 'string') return { ok: false }
    try { bruto = JSON.parse(params.pessoal) } catch { return { ok: false } }
  }
  let selecionarSemInteresse = semInteresse
  // Sem interesse é uma seleção visual. O parser de domínio continua aceitando
  // somente as origens de aquisição; a consulta abrange qualquer uma delas.
  if (bruto && typeof bruto === 'object' && !Array.isArray(bruto)) {
    const entrada = { ...bruto } as Record<string, unknown>
    if (entrada.origem === 'sem_interesse') { delete entrada.origem; selecionarSemInteresse = true }
    bruto = entrada
  }
  const lidos = lerFiltrosPessoais(bruto)
  if (!lidos.ok || !selecionarSemInteresse) return lidos
  return { ok: true, filtros: { ...lidos.filtros, disponibilidade: 'sem_interesse' } }
}
export function filtrosDaConsulta(params: Record<string, string | string[] | undefined>): FiltrosPessoais {
  const r = lerConsultaPessoal(params)
  return r.ok ? r.filtros : {}
}
export function urlAtendimento(empresaId: string, filtros: FiltrosPessoais): string {
  return urlPessoal(filtros, Number(filtros.pagina || 1)).replace('/fila/localizar', `/fila/atendimento/${encodeURIComponent(empresaId)}`)
}

export function urlAtendimentoLateral(empresaId: string, filtros: FiltrosPessoais, recolhido: boolean): string {
  return urlPessoal(filtros, Number(filtros.pagina || 1), recolhido)
    .replace('/fila/localizar', `/fila/localizar/atendimento/${encodeURIComponent(empresaId)}`)
}

export function idGatilhoAtendimento(empresaId: string): string {
  return 'continuar-atendimento-' + empresaId
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
