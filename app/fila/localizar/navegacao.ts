import type { Filtros } from '@/src/features/prospeccao/tipos'

export function urlConsulta(filtros: Filtros, pagina: number): string {
  const params = new URLSearchParams()
  for (const campo of ['nome', 'cnae', 'uf', 'cidade', 'bairro', 'grupo'] as const) {
    if (filtros[campo]) params.set(campo, filtros[campo])
  }
  params.set('pagina', String(pagina))
  return `/fila/localizar?${params}`
}

export function selecionarGrupo(grupo: string | null): Filtros {
  return { nome:'', cnae:null, uf:null, cidade:null, bairro:null, pagina:1, grupo }
}

export function limparFiltros(filtros: Filtros): Filtros {
  return selecionarGrupo(filtros.grupo)
}

export function urlEscolhaLista(filtros: Filtros, atendimento = false, aberta = true): string {
  const consulta = urlConsulta(filtros, filtros.pagina)
  const destino = atendimento ? consulta.replace('/fila/localizar', '/fila') : consulta
  return aberta ? `${destino}&escolher_lista=1` : destino
}
