import type { Papel } from '../../server/autenticacao/linhas'
import { gerarHash, gerarSenhaProvisoria } from '../../server/autenticacao/senha'
import { validarNovoUsuario, type FaltaNovoUsuario } from './regras'
import type { Falha, RepositorioUsuarios } from './repositorio'

export type ResultadoCriar =
  | { ok: true; id: string; senhaProvisoria: string }
  | { ok: false; motivo: 'dados_invalidos'; faltas: FaltaNovoUsuario[] }
  | Falha
export type ResultadoNovaSenha = { ok: true; senhaProvisoria: string } | Falha
export type ResultadoSimples = { ok: true } | Falha

// Hash fora da transação, de propósito: scrypt leva ~800ms e não pode segurar
// conexão. Se o processo morrer entre o hash e o BEGIN, nada foi criado.
export async function criarUsuario(
  repo: RepositorioUsuarios,
  dados: { nome: string; email: string; papel: string },
): Promise<ResultadoCriar> {
  const v = validarNovoUsuario(dados)
  if (!v.ok) return { ok: false, motivo: 'dados_invalidos', faltas: v.faltas }
  const senhaProvisoria = gerarSenhaProvisoria()
  const r = await repo.criar(v.dados, await gerarHash(senhaProvisoria))
  if (!r.ok) return r
  return { ok: true, id: r.id, senhaProvisoria }
}

export async function novaSenhaProvisoria(repo: RepositorioUsuarios, id: string): Promise<ResultadoNovaSenha> {
  const senhaProvisoria = gerarSenhaProvisoria()
  const r = await repo.definirCredencial(id, await gerarHash(senhaProvisoria))
  if (!r.ok) return r
  return { ok: true, senhaProvisoria }
}

export function mudarPapel(repo: RepositorioUsuarios, id: string, papel: Papel): Promise<ResultadoSimples> {
  return repo.alterar(id, { papel })
}

export function desativar(repo: RepositorioUsuarios, id: string): Promise<ResultadoSimples> {
  return repo.desativar(id)
}

export function reativar(repo: RepositorioUsuarios, id: string): Promise<ResultadoSimples> {
  return repo.alterar(id, { ativo: true })
}
