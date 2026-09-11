import type { EmpresaComigo } from '@/src/features/fila/consulta'

export type FiltrosMeuDia = { nome: string; retorno: '' | 'atrasado' | 'hoje' }

const RETORNOS = new Set<FiltrosMeuDia['retorno']>(['', 'atrasado', 'hoje'])

type Params = Record<string, string | string[] | undefined>

export function lerFiltrosMeuDia(params: Params): { ok: true; filtros: FiltrosMeuDia } | { ok: false } {
  const { nome = '', retorno = '' } = params
  if (Array.isArray(nome) || Array.isArray(retorno)) return { ok: false }
  if (typeof nome !== 'string' || typeof retorno !== 'string') return { ok: false }

  const filtros = {
    nome: nome.trim(),
    retorno: retorno.trim(),
  }
  if (filtros.nome.length > 120) return { ok: false }
  if (!RETORNOS.has(filtros.retorno as FiltrosMeuDia['retorno'])) return { ok: false }

  return { ok: true, filtros: filtros as FiltrosMeuDia }
}

function textoComparavel(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

const PESO: Record<'atrasado' | 'hoje', number> = { atrasado: 0, hoje: 1 }

export function agendaDoDia(linhas: EmpresaComigo[]): EmpresaComigo[] {
  return linhas
    .filter((l): l is EmpresaComigo & { situacaoRetorno: 'atrasado' | 'hoje' } =>
      l.situacaoRetorno === 'atrasado' || l.situacaoRetorno === 'hoje')
    .sort((a, b) =>
      PESO[a.situacaoRetorno] - PESO[b.situacaoRetorno]
      || (a.proximoPassoData ?? '').localeCompare(b.proximoPassoData ?? '')
      || a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR')
      || a.id.localeCompare(b.id))
}

export function filtrarAgenda(linhas: EmpresaComigo[], filtros: FiltrosMeuDia): EmpresaComigo[] {
  const nome = textoComparavel(filtros.nome)
  return linhas.filter(linha => {
    const nomes = textoComparavel(`${linha.razaoSocial} ${linha.nomeFantasia ?? ''}`)
    if (nome && !nomes.includes(nome)) return false
    if (filtros.retorno && linha.situacaoRetorno !== filtros.retorno) return false
    return true
  })
}

export function urlMeuDia(filtros: FiltrosMeuDia): string {
  const params = new URLSearchParams()
  if (filtros.nome) params.set('nome', filtros.nome)
  if (filtros.retorno) params.set('retorno', filtros.retorno)
  const query = params.toString()
  return query ? `/meu-dia?${query}` : '/meu-dia'
}

// Leva os filtros do Meu dia para a ficha, para o voltar reconstruir a agenda.
export function urlFichaDoMeuDia(id: string, filtros: FiltrosMeuDia): string {
  const params = new URLSearchParams()
  if (filtros.nome) params.set('nome', filtros.nome)
  if (filtros.retorno) params.set('retorno', filtros.retorno)
  const query = params.toString()
  const base = `/carteira/${encodeURIComponent(id)}?de=meu-dia`
  return query ? `${base}&${query}` : base
}

// A decisão de "para onde volta" quando a ficha veio do Meu dia
// (`?de=meu-dia`). `params` é a query bruta da ficha: nunca vira destino por
// si só. Ou os filtros passam por `lerFiltrosMeuDia` e o destino é
// `urlMeuDia(filtros)` (que só monta `nome`/`retorno` com `URLSearchParams`,
// nunca ecoa a query), ou os filtros são recusados e o destino é o literal
// fixo `/meu-dia`. Nenhum outro caminho, protocolo ou host sai daqui.
export function voltarDoMeuDia(params: Params): string {
  const entrada = lerFiltrosMeuDia(params)
  return entrada.ok ? urlMeuDia(entrada.filtros) : '/meu-dia'
}
