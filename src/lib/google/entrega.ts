import type { CriteriosGoogle, VerificacaoGoogle } from './criterios'

export type RegraGoogle = { criterio: keyof CriteriosGoogle; opcoes: string[] }
export type EvidenciaGoogle = {
  candidata: string
  criterio: keyof CriteriosGoogle
  opcao: string
  estado: 'aprovado' | 'reprovado' | 'nao_confirmado'
  motivo: string
  fonte: string
  horario: string
  contato?: string
}
export type ReciboGoogleV2 = {
  versao: 2
  pedido_id: string
  execucao_id: string
  lote_id: string
  revisao: number
  snapshot_sha256: string
  origem_sha256: string
  resultado_sha256: string
  arquivo_original_id: string
  arquivo_resultado_id: string
  verificacoes_requeridas: VerificacaoGoogle[]
  evidencias: EvidenciaGoogle[]
}
export function regrasExigidas(c: CriteriosGoogle): RegraGoogle[] {
  const regras: RegraGoogle[] = []
  for (const criterio of ['produtos', 'excluir', 'observacoes'] as const) if (c[criterio]) regras.push({ criterio, opcoes: [c[criterio]] })
  if (c.tipos.length) regras.push({ criterio: 'tipos', opcoes: c.tipos })
  if (c.atendimento && c.atendimento !== 'priorizar_fisica') regras.push({ criterio: 'atendimento', opcoes: [c.atendimento] })
  if (c.situacao && c.situacao !== 'priorizar_funcionamento') regras.push({ criterio: 'situacao', opcoes: [c.situacao] })
  for (const criterio of ['site', 'email'] as const) if (c[criterio].length === 1) regras.push({ criterio, opcoes: c[criterio] })
  if (c.telefone.length) regras.push({ criterio: 'telefone', opcoes: c.telefone })
  for (const criterio of ['nota', 'avaliacoes'] as const) if (c[criterio] !== null) regras.push({ criterio, opcoes: [String(c[criterio])] })
  return regras
}
export function avaliarEntrega(c: CriteriosGoogle, evidencias: EvidenciaGoogle[]): { estado: 'aprovado' | 'reprovado' | 'nao_confirmado' } {
  let pendente = false
  for (const regra of regrasExigidas(c)) {
    const estados = regra.opcoes.map(opcao => evidencias.find(e => e.criterio === regra.criterio && e.opcao === opcao)?.estado ?? 'nao_confirmado')
    if (estados.includes('aprovado')) continue
    if (estados.every(e => e === 'reprovado')) return { estado: 'reprovado' }
    pendente = true
  }
  return { estado: pendente ? 'nao_confirmado' : 'aprovado' }
}
