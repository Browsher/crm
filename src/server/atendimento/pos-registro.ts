import type { TipoContato } from '../../lib/atendimento'
import type { ResumoEmpresa } from '../../lib/empresa-visual'
import type { DestinoContato, DestinoEmpresaAtual, LeituraDestino } from '../../lib/pos-registro'
import { lerResumosEmpresas } from './consulta'

async function lerAtual(usuarioId: string, empresaId: string): Promise<ResumoEmpresa | null> {
  try {
    const r = await lerResumosEmpresas(usuarioId, [empresaId])
    return r.ok ? r.empresas.find(e => e.id === empresaId) ?? null : null
  } catch { return null }
}
function projetar(empresa: ResumoEmpresa): DestinoEmpresaAtual {
  if (empresa.situacao === 'sem_interesse') return { tipo: 'sem_interesse' }
  if (empresa.situacao === 'cliente') return { tipo: 'carteira', empresaId: empresa.id! }
  if (empresa.situacao === 'atendimento' || empresa.situacao === 'a_contatar') return { tipo: 'atendimento', empresaId: empresa.id! }
  if (['primeiro_contato', 'em_negociacao', 'proposta_enviada'].includes(empresa.situacao) && empresa.negociacaoId) return { tipo: 'funil', negociacaoId: empresa.negociacaoId }
  return { tipo: 'indisponivel' }
}
// Só chamar após a confirmação da RPC: replay tem precedência sobre a fase atual.
export async function lerDestinoEmpresaAtual(usuarioId: string, empresaId: string): Promise<LeituraDestino<DestinoEmpresaAtual>> {
  const empresa = await lerAtual(usuarioId, empresaId)
  return empresa ? { ok: true, destino: projetar(empresa) } : { ok: false, motivo: 'leitura_indisponivel' }
}
export async function lerDestinoContato(usuarioId: string, empresaId: string, resultadoValidado: TipoContato): Promise<LeituraDestino<DestinoContato>> {
  const empresa = await lerAtual(usuarioId, empresaId)
  if (!empresa || ['indisponivel', 'arquivada'].includes(empresa.situacao)) return { ok: false, motivo: 'leitura_indisponivel' }
  const destino = projetar(empresa)
  if (destino.tipo === 'sem_interesse') return { ok: true, destino }
  if (['interessado', 'retornar_depois'].includes(resultadoValidado) && destino.tipo === 'funil') return { ok: true, destino }
  return { ok: true, destino: { tipo: 'permanecer' } }
}
