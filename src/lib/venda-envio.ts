import type { LeituraDestino } from './pos-registro'
export type EntradaVenda = { valor: string; data: string; observacao: string }
export type AlvoVenda = { tipo: 'primeira'; negociacaoId: string } | { tipo: 'recompra' }
export type ComandoVenda = { usuarioId: string; empresaId: string; chave: string; entrada: EntradaVenda; alvo: AlvoVenda }
export type EstadoVenda = { ok: true; leituraDestino?: LeituraDestino<{ tipo: 'carteira'; empresaId: string }>; aviso?: string } | { ok: false; erro: string; recusaConclusiva?: boolean; erroDeCampos?: boolean; indisponivel?: boolean }
export const chaveSessaoVenda = (usuarioId: string) => 'crm:venda:v1:' + usuarioId
export function criarComandoVenda(usuarioId: string, empresaId: string, alvo: AlvoVenda, entrada: EntradaVenda): ComandoVenda {
  return { usuarioId, empresaId, chave: crypto.randomUUID(), alvo: { ...alvo }, entrada: { ...entrada } }
}
export function lerComandoVenda(usuarioId: string): ComandoVenda | null {
  const bruto = sessionStorage.getItem(chaveSessaoVenda(usuarioId))
  if (!bruto) return null
  const c = JSON.parse(bruto)
  if (!c || c.usuarioId !== usuarioId || !c.empresaId || typeof c.empresaId !== 'string' || typeof c.chave !== 'string' || !c.chave || !c.entrada || ['valor','data','observacao'].some(k => typeof c.entrada[k] !== 'string') || !c.alvo || !['primeira','recompra'].includes(c.alvo.tipo) || c.alvo.tipo === 'primeira' && (typeof c.alvo.negociacaoId !== 'string' || !c.alvo.negociacaoId)) throw new Error('Não foi possível recuperar a venda anterior. Preserve esta aba e atualize a página.')
  return c
}
export function persistirComandoVenda(comando: ComandoVenda) {
  const anterior = lerComandoVenda(comando.usuarioId)
  if (anterior && JSON.stringify(anterior) !== JSON.stringify(comando)) throw new Error('Confirme o envio anterior antes de registrar outra venda.')
  sessionStorage.setItem(chaveSessaoVenda(comando.usuarioId), JSON.stringify(comando))
}
// Compare o comando completo: uma resposta tardia nunca apaga outra intenção.
export function limparVendaConfirmada(comando: ComandoVenda): boolean {
  const atual = lerComandoVenda(comando.usuarioId)
  if (!atual || JSON.stringify(atual) !== JSON.stringify(comando)) return false
  sessionStorage.removeItem(chaveSessaoVenda(comando.usuarioId))
  return true
}
export function formularioVenda(comando: ComandoVenda) {
  const f = new FormData()
  f.set('id', comando.alvo.tipo === 'primeira' ? comando.alvo.negociacaoId : comando.empresaId)
  f.set('chave', comando.chave); f.set('confirmado', 'sim')
  for (const [k,v] of Object.entries(comando.entrada)) f.set(k,v)
  return f
}
