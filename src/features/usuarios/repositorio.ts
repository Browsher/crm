import type { Papel } from '../../server/autenticacao/linhas'
import { comoUsuario, type Executar } from '../../server/db/como-usuario'
import type { NovoUsuario, Usuario } from './regras'

export type Motivo = 'sem_permissao' | 'nao_encontrado' | 'email_em_uso' | 'alvo_inativo' | 'ja_nesse_estado'
export type Falha = { ok: false; motivo: Motivo }

export interface RepositorioUsuarios {
  listar(): Promise<Usuario[]>
  criar(dados: NovoUsuario, hash: string): Promise<{ ok: true; id: string } | Falha>
  definirCredencial(id: string, hash: string): Promise<{ ok: true } | Falha>
  mudarPapel(id: string, papel: Papel): Promise<{ ok: true } | Falha>
  definirSituacao(id: string, ativo: boolean): Promise<{ ok: true } | Falha>
}

export class ResultadoDesconhecido extends Error {
  constructor(funcao: string, valor: string) {
    super(`${funcao} devolveu valor fora do vocabulário: ${JSON.stringify(valor)}`)
    this.name = 'ResultadoDesconhecido'
  }
}

// Vocabulário das funções de escrita da 0012. Object.hasOwn, não indexação
// direta, para 'toString' não virar resultado. Valor fora daqui é defeito
// nosso, não estado de negócio: lança em vez de virar { ok: false }.
const VOCABULARIO: Record<string, { ok: true } | Falha> = {
  ok: { ok: true },
  nao_encontrado: { ok: false, motivo: 'nao_encontrado' },
  alvo_inativo: { ok: false, motivo: 'alvo_inativo' },
  ja_nesse_estado: { ok: false, motivo: 'ja_nesse_estado' },
}

export function traduzirResultado(funcao: string, valor: string): { ok: true } | Falha {
  if (!Object.hasOwn(VOCABULARIO, valor)) throw new ResultadoDesconhecido(funcao, valor)
  return VOCABULARIO[valor]
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
        const c = await e<{ credencial_definir: string }>('SELECT credencial_definir($1, $2)', [id, hash])
        const t = traduzirResultado('credencial_definir', c.linhas[0].credencial_definir)
        if (!t.ok) return t
        return { ok: true as const, id }
      })
    },

    definirCredencial(id, hash) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ credencial_definir: string }>('SELECT credencial_definir($1, $2)', [id, hash])
        return traduzirResultado('credencial_definir', r.linhas[0].credencial_definir)
      })
    },

    // Continua UPDATE pela política: não há transição sem sentido em papel.
    mudarPapel(id, papel) {
      return tentar(gestorId, async (e) => {
        const r = await e('UPDATE usuario SET papel = $2 WHERE id = $1', [id, papel])
        if (r.afetadas === 0) return NAO_ENCONTRADO
        return { ok: true as const }
      })
    },

    // Função, não UPDATE: só ela distingue "não existe", "é você" e
    // "já estava nesse estado". Apaga as sessões por dentro ao desativar.
    definirSituacao(id, ativo) {
      return tentar(gestorId, async (e) => {
        const r = await e<{ usuario_situacao_definir: string }>('SELECT usuario_situacao_definir($1, $2)', [id, ativo])
        return traduzirResultado('usuario_situacao_definir', r.linhas[0].usuario_situacao_definir)
      })
    },
  }
}
