import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { Disponibilidade, Filtros, OpcoesFiltro, ResultadoConsulta, ResultadoOpcoes } from './tipos'

type Linha = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnae_principal: string | null
  cidade: string | null
  uf: string | null
  bairro: string | null
  disponibilidade: Disponibilidade
}

async function tentar<T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>): Promise<T | { ok: false; motivo: 'sem_permissao' }> {
  try {
    return await comoUsuario(usuarioId, trabalho)
  } catch (erro) {
    if ((erro as { code?: string })?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
    throw erro
  }
}

export function consultarEmpresas(usuarioId: string, filtros: Filtros): Promise<ResultadoConsulta> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<Linha>('SELECT * FROM public.empresa_consultar($1,$2,$3,$4,$5,$6)', [
      filtros.nome, filtros.cnae, filtros.uf, filtros.cidade, filtros.bairro, filtros.pagina,
    ])
    return {
      ok: true as const,
      temProxima: linhas.length > 20,
      empresas: linhas.slice(0, 20).map(linha => ({
        id: linha.id,
        razaoSocial: linha.razao_social,
        nomeFantasia: linha.nome_fantasia,
        cnaePrincipal: linha.cnae_principal,
        cidade: linha.cidade,
        uf: linha.uf,
        bairro: linha.bairro,
        disponibilidade: linha.disponibilidade,
      })),
    }
  })
}

export function listarOpcoes(usuarioId: string, uf: string | null, cidade: string | null): Promise<ResultadoOpcoes> {
  return tentar(usuarioId, async executar => {
    const { linhas } = await executar<OpcoesFiltro>('SELECT * FROM public.empresa_filtros($1,$2)', [uf, cidade])
    return { ok: true as const, opcoes: linhas }
  })
}
