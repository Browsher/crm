'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { lerFichaEmpresa, type FichaEmpresa } from './ficha-leitura'
import { navegacaoFicha } from './ficha-navegacao'

type ResultadoFicha = ({ ok: true; ficha: FichaEmpresa } & Pick<ReturnType<typeof navegacaoFicha>, 'abaInicial' | 'origemHistorico'>)
  | { ok: false; motivo: 'nao_encontrada' | 'falha_leitura' }

export async function lerFichaEmpresaAcao(href: string): Promise<ResultadoFicha> {
  const eu = await exigir('gestor')
  const partes = typeof href === 'string' && /^\/empresas\/([^/?#]+)(?:\?([^#]*))?$/.exec(href)
  if (!partes) return { ok: false, motivo: 'nao_encontrada' }

  const [, id, busca] = partes
  const parametros = new URLSearchParams(busca)
  const consulta = Object.fromEntries([...new Set(parametros.keys())].map(chave => {
    const valores = parametros.getAll(chave)
    return [chave, valores.length === 1 ? valores[0] : valores]
  }))

  try {
    const ficha = await lerFichaEmpresa(eu.usuarioId, id)
    if (!ficha) return { ok: false, motivo: 'nao_encontrada' }
    const { abaInicial, origemHistorico } = navegacaoFicha(ficha.empresa.situacao === 'arquivada', consulta)
    return { ok: true, ficha, abaInicial, origemHistorico }
  } catch {
    return { ok: false, motivo: 'falha_leitura' }
  }
}
