import { randomBytes } from 'node:crypto'
import { comAdmin, comBanco } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { fecharPool } from '@/src/server/db/pool'

export type BancoDeTeste = {
  nome: string
  urlAdmin: string
  urlApp: string
  sql: <T>(texto: string, params?: unknown[]) => Promise<T[]>
  derrubar: () => Promise<void>
}

type Opcoes = { semMigracoes?: boolean }

// Senha SÓ do container local. Papel é global no cluster; repetir o ALTER por
// arquivo de teste é inofensivo.
const SENHA_APP_TESTE = 'teste'

export async function criarBancoDeTeste(opcoes: Opcoes = {}): Promise<BancoDeTeste> {
  const urlServidor = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
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

  return {
    nome,
    urlAdmin,
    urlApp,
    sql: async <T,>(texto: string, params?: unknown[]) =>
      comAdmin(urlAdmin, async (c) => (await c.query(texto, params)).rows as T[]),
    derrubar: async () => {
      await fecharPool(urlApp)
      // WITH (FORCE) derruba conexões pendentes no fim do arquivo de teste.
      await comAdmin(urlServidor, (c) => c.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`))
    },
  }
}
