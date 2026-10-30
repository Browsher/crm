import type { ResumoEmpresaGestor } from '../../lib/empresa-visual'
import { comoUsuario } from '../db/como-usuario'

export type ResultadoResumosGestor = { ok: true; empresas: ResumoEmpresaGestor[] } | { ok: false; motivo: 'sem_permissao' | 'dados_invalidos' }
export async function lerResumosEmpresasGestor(usuarioId: string, empresaIds: readonly string[]): Promise<ResultadoResumosGestor> {
  const ids = [...new Set(empresaIds)]
  if (ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) return { ok: false, motivo: 'dados_invalidos' }
  try {
    return await comoUsuario(usuarioId, async sql => (await sql<{ resultado: ResultadoResumosGestor }>('SELECT gestor_empresas_resumos_ler($1::uuid[]) AS resultado', [ids])).linhas[0].resultado)
  } catch (erro) {
    if ((erro as { code?: string }).code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
