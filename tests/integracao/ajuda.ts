import { randomBytes } from 'node:crypto'
import { comAdmin, comBanco } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'

export type BancoDeTeste = {
  nome: string
  urlAdmin: string
  sql: <T>(texto: string, params?: unknown[]) => Promise<T[]>
  derrubar: () => Promise<void>
}

type Opcoes = { semMigracoes?: boolean }

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
  }

  return {
    nome,
    urlAdmin,
    sql: async <T,>(texto: string, params?: unknown[]) =>
      comAdmin(urlAdmin, async (c) => (await c.query(texto, params)).rows as T[]),
    derrubar: async () => {
      // WITH (FORCE) derruba conexões pendentes no fim do arquivo de teste.
      await comAdmin(urlServidor, (c) => c.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`))
    },
  }
}
