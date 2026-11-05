import { limitesPeriodoAgenda, type PeriodoAgenda } from '@/src/lib/agenda-periodos'
import { nomeEmpresa } from '@/src/lib/empresa-apresentacao'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'

export type FiltrosMeuDia = { nome: string; retorno: '' | 'atrasado' | 'hoje' | 'proximos'; periodo: PeriodoAgenda }

const RETORNOS = new Set<FiltrosMeuDia['retorno']>(['', 'atrasado', 'hoje', 'proximos'])
const PERIODOS = new Set<PeriodoAgenda>(['', 'amanha', 'semana_que_vem', 'mes_que_vem'])

type Params = Record<string, string | string[] | undefined>

export function lerFiltrosMeuDia(params: Params): { ok: true; filtros: FiltrosMeuDia } | { ok: false } {
  const { nome = '', retorno = '', periodo = '' } = params
  if (Array.isArray(nome) || Array.isArray(retorno) || Array.isArray(periodo)) return { ok: false }
  if (typeof nome !== 'string' || typeof retorno !== 'string' || typeof periodo !== 'string') return { ok: false }

  const filtros = {
    nome: nome.trim(),
    retorno: retorno.trim(),
    periodo: periodo.trim(),
  }
  if (filtros.nome.length > 120) return { ok: false }
  if (!RETORNOS.has(filtros.retorno as FiltrosMeuDia['retorno'])) return { ok: false }

  if (!PERIODOS.has(filtros.periodo as PeriodoAgenda)) return { ok: false }
  if (filtros.retorno !== 'proximos') filtros.periodo = ''

  return { ok: true, filtros: filtros as FiltrosMeuDia }
}

function textoComparavel(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

const PESO: Record<'atrasado' | 'hoje' | 'futuro', number> = { atrasado: 0, hoje: 1, futuro: 2 }

export function agendaDoDia(linhas: EmpresaComigo[]): EmpresaComigo[] {
  return linhas
    .filter((l): l is EmpresaComigo & { situacaoRetorno: 'atrasado' | 'hoje' | 'futuro' } =>
      l.situacaoRetorno === 'atrasado' || l.situacaoRetorno === 'hoje' || l.situacaoRetorno === 'futuro')
    .sort((a, b) =>
      PESO[a.situacaoRetorno] - PESO[b.situacaoRetorno]
      || (a.proximoPassoData ?? '').localeCompare(b.proximoPassoData ?? '')
      || (a.empresa?.nome ?? nomeEmpresa(a)).localeCompare(b.empresa?.nome ?? nomeEmpresa(b), 'pt-BR')
      || a.id.localeCompare(b.id))
}

export function filtrarAgenda(linhas: EmpresaComigo[], filtros: FiltrosMeuDia, hoje: string): EmpresaComigo[] {
  const limites = filtros.retorno === 'proximos' ? limitesPeriodoAgenda(hoje, filtros.periodo) : null
  const nome = textoComparavel(filtros.nome)
  return linhas.filter(linha => {
    const nomes = textoComparavel(`${linha.razaoSocial ?? ''} ${linha.nomeFantasia ?? ''}`)
    if (nome && !nomes.includes(nome)) return false
    if (limites) {
      if (linha.situacaoRetorno !== 'futuro' || !linha.proximoPassoData) return false
      return linha.proximoPassoData >= limites.inicio && (!limites.fim || linha.proximoPassoData <= limites.fim)
    }
    if (filtros.retorno && linha.situacaoRetorno !== filtros.retorno) return false
    return true
  })
}

export function urlMeuDia(filtros: FiltrosMeuDia): string {
  const params = new URLSearchParams()
  if (filtros.nome) params.set('nome', filtros.nome)
  if (filtros.retorno) params.set('retorno', filtros.retorno)
  if (filtros.retorno === 'proximos' && filtros.periodo) params.set('periodo', filtros.periodo)
  const query = params.toString()
  return query ? `/meu-dia?${query}` : '/meu-dia'
}

// Leva os filtros do Meu dia para a ficha, para o voltar reconstruir a agenda.
export function urlFichaDoMeuDia(id: string, filtros: FiltrosMeuDia): string {
  const params = new URLSearchParams()
  if (filtros.nome) params.set('nome', filtros.nome)
  if (filtros.retorno) params.set('retorno', filtros.retorno)
  if (filtros.retorno === 'proximos' && filtros.periodo) params.set('periodo', filtros.periodo)
  const query = params.toString()
  const base = `/carteira/${encodeURIComponent(id)}?de=meu-dia`
  return query ? `${base}&${query}` : base
}

// A decisão de "para onde volta" quando a ficha veio do Meu dia
// (`?de=meu-dia`). `params` é a query bruta da ficha: nunca vira destino por
// si só. Ou os filtros passam por `lerFiltrosMeuDia` e o destino é
// `urlMeuDia(filtros)` (que só monta `nome`/`retorno`/`periodo` com `URLSearchParams`,
// nunca ecoa a query), ou os filtros são recusados e o destino é o literal
// fixo `/meu-dia`. Nenhum outro caminho, protocolo ou host sai daqui.
export function voltarDoMeuDia(params: Params): string {
  const entrada = lerFiltrosMeuDia(params)
  return entrada.ok ? urlMeuDia(entrada.filtros) : '/meu-dia'
}
