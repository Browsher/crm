import { TIPOS_CONTATO, type TipoContato } from './tipos'

export type RascunhoContato = {
  tipo: TipoContato
  nota: string
  proximoPasso: string
  proximoPassoData: string
}

export function rascunhoInicial(posse: boolean): RascunhoContato {
  return { tipo: posse ? 'acompanhamento' : 'nao_liguei', nota: '', proximoPasso: '', proximoPassoData: '' }
}

export function rascunhoAlterado(rascunho: RascunhoContato, inicial = rascunhoInicial(false)): boolean {
  return (Object.keys(inicial) as (keyof RascunhoContato)[]).some(campo => rascunho[campo] !== inicial[campo])
}

export type EnvioContato = { chave: string; versao: number; valor: RascunhoContato; resolvido?: boolean }

export function lerSessaoContato(empresaId: string) {
  try { return sessionStorage.getItem('crm:contato:v1:' + empresaId) ?? '{}' } catch { return '!erro' }
}

export function decodificarSessaoContato(bruto: string | null): { valor?: RascunhoContato; envio?: EnvioContato | null; erro?: boolean } {
  if (bruto === null) return {}
  try {
    const dados = JSON.parse(bruto)
    if (!dados || typeof dados !== 'object') return { erro: true }
    if (dados.valor && (!TIPOS_CONTATO.includes(dados.valor.tipo) || ['nota','proximoPasso','proximoPassoData'].some(k => typeof dados.valor[k] !== 'string'))) return { erro: true }
    if (dados.envio && (!dados.envio.chave || !Number.isInteger(dados.envio.versao) || !dados.envio.valor)) return { erro: true }
    return dados
  } catch { return { erro: true } }
}

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

// A resposta de A não pode remover o comando B gravado durante a espera.
export function limparContatoConfirmado(empresaId: string, chaveConfirmada: string): boolean {
  const chave = 'crm:contato:v1:' + empresaId
  const salvo = sessionStorage.getItem(chave)
  if (!salvo || JSON.parse(salvo)?.envio?.chave !== chaveConfirmada) return false
  sessionStorage.removeItem(chave)
  window.dispatchEvent(new Event('crm-contato'))
  return true
}
export function contatoPendente(empresaId: string): boolean {
  try {
    const salvo = sessionStorage.getItem('crm:contato:v1:' + empresaId)
    return Boolean(salvo && JSON.parse(salvo)?.envio && !JSON.parse(salvo).envio.resolvido)
  } catch { return true }
}
