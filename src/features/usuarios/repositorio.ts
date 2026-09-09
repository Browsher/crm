import type { Papel } from '../../server/autenticacao/linhas'
import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { NovoUsuario, Usuario } from './regras'

export type Motivo = 'sem_permissao' | 'nao_encontrado' | 'email_em_uso'
export type Falha = { ok: false; motivo: Motivo }

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>
  criar(dados: NovoUsuario, hash: string): Promise<{ ok: true; id: string } | Falha>
  definirCredencial(id: string, hash: string): Promise<{ ok: true } | Falha>
  alterar(id: string, campos: { papel?: Papel; ativo?: boolean }): Promise<{ ok: true } | Falha>
  desativar(id: string): Promise<{ ok: true } | Falha>
}

type LinhaUsuario = {
  id: string
  nome: string
  email: string
  papel: Papel
  ativo: boolean
  senha_provisoria_pendente: boolean
}

const NAO_ENCONTRADO: Falha = { ok: false, motivo: 'nao_encontrado' }

// Só os dois sinais que a política produz e o UNIQUE de e-mail. O resto é
// infraestrutura e sobe como exceção.
function traduzir(erro: unknown): Falha | null {
  const e = erro as { code?: string; constraint?: string }
  if (e?.code === '42501') return { ok: false, motivo: 'sem_permissao' }
  if (e?.code === '23505' && e.constraint === 'usuario_email_key') return { ok: false, motivo: 'email_em_uso' }
  return null
}

async function tentar<T>(gestorId: string, trabalho: (executar: Executar) => Promise<T | Falha>): Promise<T | Falha> {
  try {
    return await comoUsuario(gestorId, trabalho)
  } catch (erro) {
    const falha = traduzir(erro)
    if (falha) return falha
    throw erro
  }
}

// Uma transação por operação. Quem chama já verificou que gestorId é a
// sessão viva; o banco decide se ela pode.
export function repositorioPostgres(gestorId: string): RepositorioUsuarios {
  return {
    async listar() {
      const r = await comoUsuario(gestorId, (e) =>
        e<LinhaUsuario>('SELECT id, nome, email, papel, ativo, senha_provisoria_pendente FROM usuario ORDER BY ativo DESC, nome'),
      )
      return r.linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        email: l.email,
        papel: l.papel,
        ativo: l.ativo,
        senhaProvisoriaPendente: l.senha_provisoria_pendente,
      }))
    },

    // INSERT e credencial na mesma transação. O hash chega pronto: scrypt não
    // roda segurando conexão (decisão fechada na spec; não mover para dentro).
    criar(dados, hash) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ id: string }>(
          'INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, $3, true) RETURNING id',
          [dados.nome, dados.email, dados.papel],
        )
        const id = r.linhas[0].id
        await e('SELECT credencial_definir($1, $2)', [id, hash])
        return { ok: true as const, id }
      })
    },

    definirCredencial(id, hash) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ credencial_definir: boolean }>('SELECT credencial_definir($1, $2)', [id, hash])
        if (!r.linhas[0].credencial_definir) return NAO_ENCONTRADO
        return { ok: true as const }
      })
    },

    alterar(id, campos) {
      return tentar(gestorId, async (e) => {
        const r = await e('UPDATE usuario SET papel = COALESCE($2, papel), ativo = COALESCE($3, ativo) WHERE id = $1', [
          id,
          campos.papel ?? null,
          campos.ativo ?? null,
        ])
        if (r.afetadas === 0) return NAO_ENCONTRADO
        return { ok: true as const }
      })
    },

    // UPDATE primeiro: é ele quem diz se o alvo existe e se posso tocá-lo.
    // A função só complementa, na mesma transação.
    desativar(id) {
      return tentar(gestorId, async (e) => {
        const r = await e('UPDATE usuario SET ativo = false WHERE id = $1', [id])
        if (r.afetadas === 0) return NAO_ENCONTRADO
        await e('SELECT sessoes_encerrar_de($1)', [id])
        return { ok: true as const }
      })
    },
  }
}
