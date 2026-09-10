import { randomBytes } from 'node:crypto'
import { gerarHash } from '@/src/server/autenticacao/senha'
import { comAdmin, comBanco } from '@/src/server/db/admin'
import { comoUsuario as comoUsuarioReal, type Executar } from '@/src/server/db/como-usuario'
import { exigir, lerEnv } from '@/src/server/db/env'
import { exigirHostLocal } from '@/src/server/db/host-local'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { fecharPool } from '@/src/server/db/pool'

export type BancoDeTeste = {
  nome: string
  urlAdmin: string
  urlApp: string
  // Como dono: RLS ignorada. Para preparar cenário e para controles negativos.
  sql: <T>(texto: string, params?: unknown[]) => Promise<T[]>
  // O módulo real, como app_conexao: RLS vale.
  comoUsuario: <T>(usuarioId: string, trabalho: (executar: Executar) => Promise<T>) => Promise<T>
  derrubar: () => Promise<void>
}

type Opcoes = { semMigracoes?: boolean }

// Senha SÓ do container local. Papel é global no cluster; repetir o ALTER por
// arquivo de teste é inofensivo.
const SENHA_APP_TESTE = 'teste'

export async function criarBancoDeTeste(opcoes: Opcoes = {}): Promise<BancoDeTeste> {
  const urlServidor = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  // Antes de qualquer CREATE DATABASE ou ALTER ROLE. Cada arquivo de teste cria
  // o próprio banco por aqui, então esta função é o único gargalo que a suíte
  // não atravessa por baixo — guarda em script de CLI não seria vista por teste
  // nenhum.
  exigirHostLocal(urlServidor)
  const nome = `teste_${randomBytes(6).toString('hex')}`
  // `nome` é gerado aqui com hex, então interpolar é seguro.
  await comAdmin(urlServidor, (c) => c.query(`CREATE DATABASE ${nome}`))
  const urlAdmin = comBanco(urlServidor, nome)

  if (!opcoes.semMigracoes) {
    const r = await aplicar(urlAdmin, PASTA_MIGRACOES)
    if (!r.ok) {
      throw new Error(`migrações não aplicaram: ${r.motivo} ${JSON.stringify(r.problemas ?? r.divergentes)}`)
    }
    await comAdmin(urlAdmin, (c) => c.query(`ALTER ROLE app_conexao LOGIN PASSWORD '${SENHA_APP_TESTE}'`))
  }

  const u = new URL(urlAdmin)
  u.username = 'app_conexao'
  u.password = SENHA_APP_TESTE
  const urlApp = u.toString()
  // `chamar` e o pool usam o caminho padrão (DATABASE_URL). Definir aqui
  // exercita o caminho que a aplicação usa; `derrubar` limpa.
  process.env.DATABASE_URL = urlApp

  return {
    nome,
    urlAdmin,
    urlApp,
    sql: async <T,>(texto: string, params?: unknown[]) =>
      comAdmin(urlAdmin, async (c) => (await c.query(texto, params)).rows as T[]),
    comoUsuario: (usuarioId, trabalho) => comoUsuarioReal(usuarioId, trabalho, urlApp),
    derrubar: async () => {
      delete process.env.DATABASE_URL
      await fecharPool(urlApp)
      // WITH (FORCE) derruba conexões pendentes no fim do arquivo de teste.
      await comAdmin(urlServidor, (c) => c.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`))
    },
  }
}

// Cria usuário como dono, sem identidade: criado_por fica nulo, como no seed.
export async function criarUsuario(
  banco: BancoDeTeste,
  papel: 'vendedor' | 'gestor',
  apelido: string,
): Promise<string> {
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO usuario (nome, email, papel) VALUES ($1, $2, $3) RETURNING id',
    [apelido, `${apelido.toLowerCase()}@teste.local`, papel],
  )
  return id
}

// gerarHash custa ~800ms. Testes que não são sobre senha reusam a mesma senha;
// memoizar por senha paga uma vez por processo e o hash continua real.
const hashes = new Map<string, Promise<string>>()
function hashMemoizado(senha: string): Promise<string> {
  let h = hashes.get(senha)
  if (!h) {
    h = gerarHash(senha)
    hashes.set(senha, h)
  }
  return h
}

// Usuário com credencial, criado como dona. Para testes de login e troca.
export async function criarUsuarioComSenha(
  banco: BancoDeTeste,
  papel: 'vendedor' | 'gestor',
  apelido: string,
  senha: string,
  opcoes: { pendente?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const email = `${apelido.toLowerCase()}@teste.local`
  const [{ id }] = await banco.sql<{ id: string }>(
    'INSERT INTO usuario (nome, email, papel, senha_provisoria_pendente) VALUES ($1, $2, $3, $4) RETURNING id',
    [apelido, email, papel, opcoes.pendente ?? false],
  )
  await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, await hashMemoizado(senha)])
  return { id, email }
}
