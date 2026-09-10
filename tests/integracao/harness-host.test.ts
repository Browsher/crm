import { afterEach, expect, test } from 'vitest'
import { comAdmin } from '@/src/server/db/admin'
import { HostNaoLocal } from '@/src/server/db/host-local'
import { criarBancoDeTeste } from './ajuda'

const original = process.env.DATABASE_URL_ADMIN

afterEach(() => {
  process.env.DATABASE_URL_ADMIN = original
})

const bancosDeTeste = () =>
  comAdmin(
    original!,
    async (c) =>
      (await c.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_database WHERE datname LIKE 'teste_%'")).rows[0].n,
  )

test('host remoto é recusado antes de criar banco nenhum', async () => {
  const antes = await bancosDeTeste()

  process.env.DATABASE_URL_ADMIN = 'postgres://u:s@shuttle.proxy.rlwy.net:41234/railway'
  await expect(criarBancoDeTeste()).rejects.toBeInstanceOf(HostNaoLocal)

  process.env.DATABASE_URL_ADMIN = original
  // Se a guarda estivesse depois do CREATE DATABASE, sobraria um teste_* órfão.
  expect(await bancosDeTeste()).toBe(antes)
})
