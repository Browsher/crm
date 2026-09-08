import { describe, expect, test } from 'vitest'
import { checarMigracoes } from './checar'

const ok = (nome: string, corpo: string, comentario = '-- ver docs/db/0000.md') => ({
  nome,
  conteudo: `${comentario}\nBEGIN;\n${corpo}\nCOMMIT;\n`,
})

const problemasDe = (r: ReturnType<typeof checarMigracoes>) => (r.ok ? '' : r.problemas.join('\n'))

const valida = ok(
  '0000_papeis.sql',
  'DO $$ BEGIN CREATE ROLE app_usuario NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
)

describe('checarMigracoes', () => {
  test('arquivo bem formado passa', () => {
    expect(checarMigracoes([valida])).toEqual({ ok: true })
  })

  test('nome fora do padrão', () => {
    const r = checarMigracoes([{ ...valida, nome: 'papeis.sql' }])
    expect(r.ok).toBe(false)
    expect(problemasDe(r)).toMatch(/nome/)
  })

  test('numeração precisa começar em 0000 e ser contígua', () => {
    const r = checarMigracoes([valida, ok('0002_x.sql', 'SELECT 1;')])
    expect(problemasDe(r)).toMatch(/0001/)
  })

  test('sem BEGIN; na primeira linha de código ou COMMIT; na última', () => {
    const semBegin = { nome: '0000_a.sql', conteudo: 'SELECT 1;\nCOMMIT;\n' }
    const semCommit = { nome: '0000_a.sql', conteudo: 'BEGIN;\nSELECT 1;\n' }
    expect(checarMigracoes([semBegin]).ok).toBe(false)
    expect(checarMigracoes([semCommit]).ok).toBe(false)
  })

  test('controle de transação no meio é recusado', () => {
    for (const cmd of ['COMMIT;', 'ROLLBACK;', 'SAVEPOINT a;', 'BEGIN;']) {
      expect(checarMigracoes([ok('0000_a.sql', `SELECT 1;\n${cmd}\nSELECT 2;`)]).ok).toBe(false)
    }
  })

  test('BEGIN e END do plpgsql em linha própria não são controle de transação', () => {
    const plpgsql = ['CREATE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $$', 'BEGIN', '  RETURN NEW;', 'END', '$$;'].join('\n')
    expect(checarMigracoes([ok('0000_a.sql', plpgsql)]).ok).toBe(true)
  })

  test('DROP TABLE e DROP COLUMN barrados, DROP INDEX e DROP CONSTRAINT liberados', () => {
    expect(checarMigracoes([ok('0000_a.sql', 'DROP TABLE x;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'ALTER TABLE x DROP COLUMN y;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'DROP INDEX x_idx;')]).ok).toBe(true)
    expect(checarMigracoes([ok('0000_a.sql', 'ALTER TABLE x DROP CONSTRAINT y;')]).ok).toBe(true)
  })

  test('comandos que não rodam em transação são barrados', () => {
    for (const cmd of [
      'CREATE INDEX CONCURRENTLY i ON x (a);',
      'VACUUM x;',
      'CREATE DATABASE y;',
      "ALTER SYSTEM SET a = 'b';",
    ]) {
      expect(checarMigracoes([ok('0000_a.sql', cmd)]).ok).toBe(false)
    }
  })

  test('schema ou papel de fornecedor é recusado', () => {
    for (const ref of ['auth.users', 'storage.objects', 'supabase_auth_admin', 'authenticated', 'anon']) {
      expect(checarMigracoes([ok('0000_a.sql', `GRANT SELECT ON x TO ${ref};`)]).ok).toBe(false)
    }
  })

  test('CREATE TABLE exige PK uuid com gen_random_uuid(), salvo exceções', () => {
    const pk = (cols: string) => checarMigracoes([ok('0000_a.sql', `CREATE TABLE x (${cols});`)]).ok
    expect(pk('id uuid PRIMARY KEY DEFAULT gen_random_uuid()')).toBe(true)
    expect(pk('id serial PRIMARY KEY')).toBe(false)
    expect(pk('id uuid PRIMARY KEY REFERENCES y (id)')).toBe(true)
    expect(pk('codigo text PRIMARY KEY')).toBe(true)
  })

  test('comentário: só uma linha, só no topo, só --, até 120 caracteres', () => {
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1; -- inline')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', '/* bloco */ SELECT 1;')]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1;', `-- ${'x'.repeat(130)}`)]).ok).toBe(false)
    expect(checarMigracoes([ok('0000_a.sql', 'SELECT 1;', '-- a\n-- b')]).ok).toBe(false)
    expect(checarMigracoes([{ nome: '0000_a.sql', conteudo: 'BEGIN;\nSELECT 1;\nCOMMIT;\n' }]).ok).toBe(true)
  })
})
