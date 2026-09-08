import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

const TABELAS = ['credencial', 'sessao', 'tentativa_login']

describe('schema autenticacao', () => {
  test('três tabelas com RLS e nenhuma política', async () => {
    const t = await banco.sql<{ nome: string; rls: boolean }>(`
      SELECT c.relname AS nome, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'autenticacao' AND c.relkind = 'r' ORDER BY 1`)
    expect(t).toEqual(TABELAS.map((nome) => ({ nome, rls: true })))
    const p = await banco.sql("SELECT 1 FROM pg_policies WHERE schemaname = 'autenticacao'")
    expect(p).toEqual([])
  })

  test('app_conexao tem USAGE no schema e nenhum privilégio de tabela; app_usuario e app_conferencia nada', async () => {
    const usage = await banco.sql<{ papel: string; usa: boolean }>(`
      SELECT r.rolname AS papel, has_schema_privilege(r.rolname, 'autenticacao', 'USAGE') AS usa
      FROM pg_roles r WHERE r.rolname IN ('app_conexao', 'app_usuario', 'app_conferencia') ORDER BY 1`)
    expect(usage).toEqual([
      { papel: 'app_conexao', usa: true },
      { papel: 'app_conferencia', usa: false },
      { papel: 'app_usuario', usa: false },
    ])
    for (const tabela of TABELAS) {
      const r = await banco.sql<{ le: boolean; escreve: boolean }>(
        `SELECT has_table_privilege('app_conexao', 'autenticacao.${tabela}', 'SELECT') AS le,
                has_table_privilege('app_conexao', 'autenticacao.${tabela}', 'INSERT, UPDATE, DELETE') AS escreve`,
      )
      expect(r[0]).toEqual({ le: false, escreve: false })
    }
  })

  test('SELECT direto em cada tabela como app_conexao é 42501', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      for (const tabela of TABELAS) {
        await expect(c.query(`SELECT 1 FROM autenticacao.${tabela}`)).rejects.toMatchObject({ code: '42501' })
      }
    } finally {
      c.release()
    }
  })

  test('usuario.senha_provisoria_pendente existe, NOT NULL, default false', async () => {
    const r = await banco.sql<{ nulo: string; padrao: string }>(`
      SELECT is_nullable AS nulo, column_default AS padrao FROM information_schema.columns
      WHERE table_name = 'usuario' AND column_name = 'senha_provisoria_pendente'`)
    expect(r).toEqual([{ nulo: 'NO', padrao: 'false' }])
  })
})
