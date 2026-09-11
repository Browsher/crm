import type { TipoContato } from './tipos'

export type RascunhoContato = {
  tipo: TipoContato
  nota: string
  proximoPasso: string
  proximoPassoData: string
}

export function rascunhoInicial(posse: boolean): RascunhoContato {
  return { tipo: posse ? 'acompanhamento' : 'nao_liguei', nota: '', proximoPasso: '', proximoPassoData: '' }
}

export function rascunhoAlterado(rascunho: RascunhoContato): boolean {
  return rascunho.tipo !== 'nao_liguei' || Boolean(rascunho.nota || rascunho.proximoPasso || rascunho.proximoPassoData)
}
