import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { FUNCOES } from '@/src/server/db/sem-identidade'
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

  test('as três listas são uma: chaves de FUNCOES = funções com EXECUTE para app_conexao = todas as funções do schema', async () => {
    const funcoes = await banco.sql<{ nome: string; conexao: boolean; usuario: boolean; conferencia: boolean }>(`
      SELECT p.proname AS nome,
             has_function_privilege('app_conexao', p.oid, 'EXECUTE') AS conexao,
             has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario,
             has_function_privilege('app_conferencia', p.oid, 'EXECUTE') AS conferencia
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'autenticacao' ORDER BY 1`)
    const noBanco = funcoes.map((f) => f.nome)
    const noMapa = Object.keys(FUNCOES).sort()
    expect(noBanco).toEqual(noMapa)
    expect(funcoes.filter((f) => f.conexao).map((f) => f.nome)).toEqual(noMapa)
    expect(funcoes.filter((f) => f.usuario || f.conferencia)).toEqual([])
  })

  test('controle negativo: uma função a mais no schema, ou EXECUTE a mais, aparece na mesma consulta', async () => {
    await banco.sql("CREATE FUNCTION autenticacao.intrusa() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1'")
    await banco.sql('GRANT EXECUTE ON FUNCTION autenticacao.sessao_atual(text) TO app_usuario')
    try {
      const funcoes = await banco.sql<{ nome: string; usuario: boolean }>(`
        SELECT p.proname AS nome, has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'autenticacao' ORDER BY 1`)
      expect(funcoes.map((f) => f.nome)).not.toEqual(Object.keys(FUNCOES).sort())
      // Função nova nasce com EXECUTE para PUBLIC. Sem REVOKE, app_usuario executa
      // `intrusa` também: é o esquecimento que o teste principal acusaria.
      expect(funcoes.filter((f) => f.usuario).map((f) => f.nome)).toEqual(['intrusa', 'sessao_atual'])
    } finally {
      await banco.sql('DROP FUNCTION autenticacao.intrusa()')
      await banco.sql('REVOKE EXECUTE ON FUNCTION autenticacao.sessao_atual(text) FROM app_usuario')
    }
  })

  test('SELECT direto em cada tabela como app_teste é 42501', async () => {
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
