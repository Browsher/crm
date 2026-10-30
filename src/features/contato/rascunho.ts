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

export type EnvioContato = { chave: string; versao: number; valor: RascunhoContato; resolvido?: boolean }
export function descartarRascunhoContato(empresaId: string): boolean {
  try {
    const chave = 'crm:contato:v1:' + empresaId
    const salvo = sessionStorage.getItem(chave)
    if (salvo) {
      const dados = JSON.parse(salvo)
      if (!dados || typeof dados !== 'object' || dados.envio && !dados.envio.resolvido) return false
    }
    sessionStorage.removeItem(chave)
    window.dispatchEvent(new Event('crm-contato'))
    return true
  } catch { return false }
}
export function prepararEnvio(anterior: EnvioContato | null, versao: number, valor: RascunhoContato): EnvioContato {
  const normalizado = { tipo: valor.tipo, nota: valor.nota.trim(), proximoPasso: valor.proximoPasso.trim(), proximoPassoData: valor.proximoPassoData.trim() }
  if (anterior) {
    if (JSON.stringify(anterior.valor) !== JSON.stringify(normalizado)) throw new Error('Resolva o envio anterior antes de registrar outros dados.')
    return anterior
  }
  return { chave: crypto.randomUUID(), versao, valor: normalizado }
}
