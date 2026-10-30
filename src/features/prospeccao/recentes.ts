import { comoUsuario, type Executar } from '../../server/db/como-usuario'

type Falha = { ok: false; motivo: 'sem_permissao' }
async function tentar<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | Falha> {
  try {
    return await comoUsuario(usuarioId, trabalho)
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}
export function registrarRecente(usuarioId: string, empresaId: string): Promise<{ ok: true; registrado: boolean } | Falha> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<{ registrado: boolean }>('SELECT public.empresa_recente_registrar($1::uuid) AS registrado', [empresaId])
    return { ok: true as const, registrado: linhas[0].registrado }
  })
}
