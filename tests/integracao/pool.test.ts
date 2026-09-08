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

test('app_conexao não é superusuário, não tem BYPASSRLS e não é dona de tabela', async () => {
  const r = await banco.sql<{ rolsuper: boolean; rolbypassrls: boolean; dona: number }>(`
    SELECT r.rolsuper, r.rolbypassrls,
      (SELECT count(*)::int FROM pg_tables t WHERE t.tableowner = 'app_conexao') AS dona
    FROM pg_roles r WHERE r.rolname = 'app_conexao'`)
  expect(r[0]).toEqual({ rolsuper: false, rolbypassrls: false, dona: 0 })
})
