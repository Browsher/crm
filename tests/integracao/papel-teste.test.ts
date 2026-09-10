import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

describe('app_teste: o papel do harness', () => {
  test('existe', async () => {
    const r = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_roles WHERE rolname = 'app_teste'",
    )
    expect(r).toEqual([{ n: 1 }])
  })

  test('a migração cria o papel NOLOGIN e sem senha: é o que a Railway recebe', async () => {
    // No cluster local este papel TEM login e senha — o harness as dá, porque é
    // ele quem conecta. Então o catálogo daqui não prova nada sobre produção.
    // Quem prova é o texto da migração, que é o que roda lá.
    const sql = await readFile(join(PASTA_MIGRACOES, '0021_papel_teste.sql'), 'utf8')
    expect(sql).toMatch(/CREATE ROLE app_teste NOLOGIN/)
    expect(sql).not.toMatch(/PASSWORD/i)
    expect(sql).not.toMatch(/ALTER ROLE app_teste[^;]*LOGIN/)
  })

  test('é membro de app_conexao com herança, e de mais ninguém', async () => {
    const r = await banco.sql<{ papel: string; herda: boolean }>(`
      SELECT m.roleid::regrole::text AS papel, m.inherit_option AS herda
      FROM pg_auth_members m WHERE m.member = 'app_teste'::regrole ORDER BY 1`)
    expect(r).toEqual([{ papel: 'app_conexao', herda: true }])
  })

  test('repete os atributos da 0006 que a herança não carrega', async () => {
    const r = await banco.sql<{ rolconnlimit: number; config: string[] | null }>(`
      SELECT r.rolconnlimit,
        (SELECT s.setconfig FROM pg_db_role_setting s WHERE s.setrole = r.oid AND s.setdatabase = 0) AS config
      FROM pg_roles r WHERE r.rolname = 'app_teste'`)
    expect(r[0]).toEqual({ rolconnlimit: 20, config: ['idle_in_transaction_session_timeout=30s'] })
  })

  test('herda o que é do app_conexao: mesmas funções de autenticacao', async () => {
    const [r] = await banco.sql<{ teste: number; conexao: number; usaSchema: boolean }>(`
      SELECT
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'autenticacao' AND has_function_privilege('app_teste', p.oid, 'EXECUTE')) AS teste,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'autenticacao' AND has_function_privilege('app_conexao', p.oid, 'EXECUTE')) AS conexao,
        has_schema_privilege('app_teste', 'autenticacao', 'USAGE') AS "usaSchema"`)
    expect(r.usaSchema).toBe(true)
    expect(r.teste).toBe(r.conexao)
    expect(r.teste).toBeGreaterThan(0)
  })

  test('não alcança app_usuario: a revogação da 0006 corta a cadeia', async () => {
    const [r] = await banco.sql<{ usa: boolean; membro: boolean; le: boolean }>(`
      SELECT pg_has_role('app_teste', 'app_usuario', 'USAGE') AS usa,
             pg_has_role('app_teste', 'app_usuario', 'MEMBER') AS membro,
             has_table_privilege('app_teste', 'usuario', 'SELECT') AS le`)
    // MEMBER continua verdadeiro, e é o que permite SET ROLE em comoUsuario.
    // USAGE falso é o que faz o SELECT direto ser 42501.
    expect(r).toEqual({ usa: false, membro: true, le: false })
  })

  test('não lê tabela de autenticacao direto', async () => {
    const [r] = await banco.sql<{ le: boolean }>(
      "SELECT has_table_privilege('app_teste', 'autenticacao.sessao', 'SELECT') AS le",
    )
    expect(r.le).toBe(false)
  })
})
