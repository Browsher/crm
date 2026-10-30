import { resumoEmpresa, type ResumoEmpresa } from '../../lib/empresa-visual'
import { lerDetalhesEmpresa } from '../empresas/detalhes'
import { comoUsuario } from '../db/como-usuario'

export async function lerResumosBusca(usuarioId: string, buscaId: string) {
  const ids = await comoUsuario(usuarioId, async sql => (await sql<{ id: string }>(`SELECT DISTINCT e.id FROM busca_empresa b
    CROSS JOIN LATERAL jsonb_array_elements(b.empresas) item
    JOIN empresa e ON e.cnpj=item->>'cnpj'
    JOIN empresa_vinculo v ON v.empresa_id=e.id AND v.vendedor_id=usuario_atual()
    WHERE b.id=$1 AND b.usuario_id=usuario_atual()`, [buscaId])).linhas.map(e => e.id))
  return lerResumosEmpresas(usuarioId, ids)
}

export async function lerResumosEmpresas(usuarioId: string, empresaIds: readonly string[]): Promise<{ ok: true; empresas: ResumoEmpresa[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' }> {
  const ids = [...new Set(empresaIds)]
  if (ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) return { ok: false, motivo: 'dados_invalidos' }
  try {
    return await comoUsuario(usuarioId, async sql => (await sql<{ resultado: { ok: true; empresas: ResumoEmpresa[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' } }>('SELECT empresas_resumos_ler($1::uuid[]) AS resultado', [ids])).linhas[0].resultado)
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export async function lerAtendimento(usuarioId: string, empresaId: string): Promise<{ ok: true; empresa: ResumoEmpresa; fase: 'inicial' | 'negociacao' | 'cliente' } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' }> {
  const r = await lerDetalhesEmpresa(usuarioId, { tipo: 'cadastro', empresaId })
  if (!r.ok) return r
  const empresa = resumoEmpresa(r.dados)
  const fase = empresa.situacao === 'cliente' ? 'cliente' : ['primeiro_contato', 'em_negociacao', 'proposta_enviada'].includes(empresa.situacao) ? 'negociacao' : 'inicial'
  return { ok: true, empresa, fase }
}
