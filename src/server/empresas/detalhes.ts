import { detalhesSnapshot, type DetalhesEmpresa, type EmpresaSnapshot, type ReferenciaEmpresa } from '../../lib/empresa-visual'
import { comoUsuario } from '../db/como-usuario'

export type ResultadoDetalhesEmpresa = { ok: true; dados: DetalhesEmpresa } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' }
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
function valida(r: ReferenciaEmpresa) {
  if (!r || typeof r !== 'object') return false
  if (r.tipo === 'cadastro') return typeof r.empresaId === 'string' && UUID.test(r.empresaId)
  return r.tipo === 'busca' && typeof r.buscaId === 'string' && UUID.test(r.buscaId) && typeof r.cnpj === 'string' && /^[0-9A-Z]{12}[0-9]{2}$/.test(r.cnpj)
}
export async function lerDetalhesEmpresa(usuarioId: string, referencia: ReferenciaEmpresa): Promise<ResultadoDetalhesEmpresa> {
  if (!valida(referencia)) return { ok: false, motivo: 'nao_encontrada' }
  try {
    return await comoUsuario(usuarioId, async sql => {
      if (referencia.tipo === 'cadastro') {
        const { linhas } = await sql<{ resultado: ResultadoDetalhesEmpresa }>('SELECT empresa_detalhes_ler($1) AS resultado', [referencia.empresaId])
        return linhas[0].resultado
      }
      type Snapshot = { ok: true; empresa: EmpresaSnapshot; recebidaEm: string | null; motivoIndisponibilidade?: 'pendente' | null } | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' }
      const { linhas } = await sql<{ resultado: Snapshot }>('SELECT busca_empresa_detalhes_ler($1,$2) AS resultado', [referencia.buscaId, referencia.cnpj])
      const r = linhas[0].resultado
      if (!r.ok) return r
      return { ok: true, dados: { ...detalhesSnapshot(r.empresa, referencia, r.recebidaEm), motivoIndisponibilidade: r.motivoIndisponibilidade } }
    })
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
