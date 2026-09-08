import { afterAll, expect, test } from 'vitest'
import { comAdmin } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { criarBancoDeTeste } from './ajuda'

const bancos: Awaited<ReturnType<typeof criarBancoDeTeste>>[] = []
afterAll(async () => {
  for (const b of bancos) await b.derrubar()
})

test('cria um banco com nome único e consulta nele', async () => {
  const banco = await criarBancoDeTeste()
  bancos.push(banco)
  expect(banco.nome).toMatch(/^teste_[0-9a-f]{12}$/)
  const linhas = await banco.sql<{ atual: string }>('SELECT current_database() AS atual')
  expect(linhas[0].atual).toBe(banco.nome)
})

test('derrubar apaga o banco', async () => {
  const banco = await criarBancoDeTeste()
  await banco.derrubar()
  const urlAdmin = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  const existe = await comAdmin(urlAdmin, async (c) => {
    const { rows } = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [banco.nome])
    return rows.length
  })
  expect(existe).toBe(0)
})
