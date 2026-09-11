import type { EmpresaComigo } from '@/src/features/fila/consulta'

export type FiltrosCarteira = {
  nome: string
  uf: string
  retorno: '' | 'atrasado' | 'hoje' | 'futuro' | 'sem_data'
}

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
])
const RETORNOS = new Set<FiltrosCarteira['retorno']>(['', 'atrasado', 'hoje', 'futuro', 'sem_data'])

type Params = Record<string, string | string[] | undefined>

export function lerFiltrosCarteira(params: Params): { ok: true; filtros: FiltrosCarteira } | { ok: false } {
  const { nome = '', uf = '', retorno = '' } = params
  if (Array.isArray(nome) || Array.isArray(uf) || Array.isArray(retorno)) return { ok: false }
  if (typeof nome !== 'string' || typeof uf !== 'string' || typeof retorno !== 'string') return { ok: false }

  const filtros = {
    nome: nome.trim(),
    uf: uf.trim().toUpperCase(),
    retorno: retorno.trim(),
  }
  if (filtros.nome.length > 120) return { ok: false }
  if (filtros.uf !== '' && !UFS.has(filtros.uf)) return { ok: false }
  if (!RETORNOS.has(filtros.retorno as FiltrosCarteira['retorno'])) return { ok: false }

  return { ok: true, filtros: filtros as FiltrosCarteira }
}

function textoComparavel(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function filtrarCarteira(linhas: EmpresaComigo[], filtros: FiltrosCarteira): EmpresaComigo[] {
  const nome = textoComparavel(filtros.nome)
  return linhas
    .filter(linha => {
      const nomes = textoComparavel(`${linha.razaoSocial} ${linha.nomeFantasia ?? ''}`)
      if (nome && !nomes.includes(nome)) return false
      if (filtros.uf && linha.endereco?.uf !== filtros.uf) return false
      if (filtros.retorno && linha.situacaoRetorno !== filtros.retorno) return false
      return true
    })
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR') || a.id.localeCompare(b.id))
}

export function urlCarteira(filtros: FiltrosCarteira): string {
  const params = new URLSearchParams()
  if (filtros.nome) params.set('nome', filtros.nome)
  if (filtros.uf) params.set('uf', filtros.uf)
  if (filtros.retorno) params.set('retorno', filtros.retorno)
  const query = params.toString()
  return query ? `/carteira?${query}` : '/carteira'
}

export function urlFicha(id: string, filtros: FiltrosCarteira): string {
  return urlCarteira(filtros).replace('/carteira', `/carteira/${encodeURIComponent(id)}`)
}
