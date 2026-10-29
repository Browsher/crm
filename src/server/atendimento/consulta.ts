import { resumoEmpresa, type ResumoEmpresa } from '../../lib/empresa-visual'
import { lerDetalhesEmpresa } from '../empresas/detalhes'

export async function lerAtendimento(usuarioId: string, empresaId: string): Promise<{ ok: true; empresa: ResumoEmpresa; fase: 'inicial' | 'negociacao' | 'cliente' } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' }> {
  const r = await lerDetalhesEmpresa(usuarioId, { tipo: 'cadastro', empresaId })
  if (!r.ok) return r
  if (r.dados.situacao === 'indisponivel') return { ok: false, motivo: 'sem_permissao' }
  const empresa = resumoEmpresa(r.dados)
  const fase = empresa.situacao === 'cliente' ? 'cliente' : ['primeiro_contato', 'em_negociacao', 'proposta_enviada'].includes(empresa.situacao) ? 'negociacao' : 'inicial'
  return { ok: true, empresa, fase }
}
