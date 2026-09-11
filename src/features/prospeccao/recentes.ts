import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { ResumoEmpresa } from './tipos'

type Falha = { ok: false; motivo: 'sem_permissao' }
type Lista = { ok: true; empresas: ResumoEmpresa[] } | Falha
type Linha = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnae_principal: string | null
  cidade: string | null
  uf: string | null
  bairro: string | null
  disponibilidade: ResumoEmpresa['disponibilidade']
}
const resumo = (r: Linha): ResumoEmpresa => ({
  id: r.id, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia,
  cnaePrincipal: r.cnae_principal, cidade: r.cidade, uf: r.uf,
  bairro: r.bairro, disponibilidade: r.disponibilidade,
})
async function tentar<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | Falha> {
  try {
    return await comoUsuario(usuarioId, trabalho)
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
export function listarRecentes(usuarioId: string): Promise<Lista> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<Linha>('SELECT * FROM public.empresa_recentes()')
    return { ok: true as const, empresas: linhas.map(resumo) }
  })
}
export function listarSugestoes(usuarioId: string): Promise<Lista> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<Linha>('SELECT * FROM public.empresa_sugestoes()')
    return { ok: true as const, empresas: linhas.map(resumo) }
  })
}
export function lerPerfil(usuarioId: string, empresaId: string): Promise<{ ok: true; empresa: ResumoEmpresa | null } | Falha> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<Linha>('SELECT * FROM public.empresa_perfil($1::uuid)', [empresaId])
    return { ok: true as const, empresa: linhas[0] ? resumo(linhas[0]) : null }
  })
}
export function registrarRecente(usuarioId: string, empresaId: string): Promise<{ ok: true; registrado: boolean } | Falha> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<{ registrado: boolean }>('SELECT public.empresa_recente_registrar($1::uuid) AS registrado', [empresaId])
    return { ok: true as const, registrado: linhas[0].registrado }
  })
}
