import { afterAll, expect, test, vi } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { comAdmin } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { criarBancoDeTeste } from './ajuda'

vi.mock('@/src/server/db/migracoes/aplicar', async (original) => {
  const modulo = await original<typeof import('@/src/server/db/migracoes/aplicar')>()
  return { ...modulo, aplicar: vi.fn(modulo.aplicar) }
})

test('remove o banco quando a preparação falha após CREATE DATABASE', async () => {
  let nome = ''
  const falha = new Error('falha de migração simulada')
  vi.mocked(aplicar).mockImplementationOnce(async (url) => {
    nome = new URL(url).pathname.slice(1)
    throw falha
  })
  const urlAdmin = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  try {
    await expect(criarBancoDeTeste()).rejects.toBe(falha)
    const linhas = await comAdmin(urlAdmin, async (c) =>
      (await c.query('SELECT datname FROM pg_database WHERE datname = $1', [nome])).rows)
    expect(linhas).toEqual([])
  } finally {
    if (/^teste_[0-9a-f]{12}$/.test(nome)) {
      await comAdmin(urlAdmin, (c) => c.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`))
    }
  }
})

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
