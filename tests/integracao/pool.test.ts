import { Client } from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { conectarVerificado, fecharPool, PapelPerigoso } from '@/src/server/db/pool'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await fecharPool(banco.urlAdmin)
  await banco.derrubar()
})

test('como app_conexao a guarda deixa passar', async () => {
  const c = await conectarVerificado(banco.urlApp)
  try {
    const { rows } = await c.query<{ u: string }>('SELECT current_user AS u')
    expect(rows[0].u).toBe('app_conexao')
  } finally {
    c.release()
  }
})

test('como superusuário a guarda derruba (controle negativo)', async () => {
  await expect(conectarVerificado(banco.urlAdmin)).rejects.toBeInstanceOf(PapelPerigoso)
})

test('app_conexao tem CONNECTION LIMIT 20 e timeout de transação ociosa de 30s', async () => {
  const r = await banco.sql<{ rolconnlimit: number; config: string[] | null }>(`
    SELECT r.rolconnlimit,
      (SELECT s.setconfig FROM pg_db_role_setting s WHERE s.setrole = r.oid AND s.setdatabase = 0) AS config
    FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
  expect(r[0]).toEqual({ rolconnlimit: 20, config: ['idle_in_transaction_session_timeout=30s'] })
})

test('a conexão além do limite é recusada com 53300', async () => {
  // O pool deste arquivo pode ter conexão ociosa aberta: conta o que já existe.
  const [{ n }] = await banco.sql<{ n: number }>(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = 'app_conexao'",
  )
  const abertos: Client[] = []
  try {
    for (let i = n; i < 20; i++) {
      const c = new Client({ connectionString: banco.urlApp })
      await c.connect()
      abertos.push(c)
    }
    const extra = new Client({ connectionString: banco.urlApp })
    await expect(extra.connect()).rejects.toMatchObject({ code: '53300' })
  } finally {
    await Promise.all(abertos.map((c) => c.end()))
  }
})

test('app_conexao não é superusuário, não tem BYPASSRLS e não é dona de tabela', async () => {
  const r = await banco.sql<{ rolsuper: boolean; rolbypassrls: boolean; dona: number }>(`
    SELECT r.rolsuper, r.rolbypassrls,
      (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = 'app_conexao') AS dona
    FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
  expect(r[0]).toEqual({ rolsuper: false, rolbypassrls: false, dona: 0 })
})
