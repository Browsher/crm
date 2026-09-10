import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { aplicar, situacao } from '@/src/server/db/migracoes/aplicar'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

const arq = (corpo: string) => `-- teste\nBEGIN;\n${corpo}\nCOMMIT;\n`
const tabela = (nome: string) => `CREATE TABLE ${nome} (id uuid PRIMARY KEY DEFAULT gen_random_uuid());`

async function pastaCom(arquivos: Record<string, string>): Promise<string> {
  const pasta = await mkdtemp(join(tmpdir(), 'migracoes-'))
  for (const [nome, conteudo] of Object.entries(arquivos)) await writeFile(join(pasta, nome), conteudo)
  return pasta
}

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

describe('aplicar', () => {
  test('aplica do zero e registra a soma do arquivo em disco', async () => {
    const pasta = await pastaCom({ '0000_a.sql': arq(tabela('a')) })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r).toEqual({ ok: true, aplicadas: ['0000_a.sql'] })
    const linhas = await banco.sql<{ nome: string; soma: string }>(
      "SELECT nome, soma FROM _migracao WHERE nome = '0000_a.sql'",
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0].soma).toMatch(/^[0-9a-f]{64}$/)
    const tabelas = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'a'")
    expect(tabelas[0].n).toBe(1)
  })

  test('segunda execução não faz nada', async () => {
    const pasta = await pastaCom({ '0000_a.sql': arq(tabela('a')) })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r).toEqual({ ok: true, aplicadas: [] })
  })

  test('arquivo alterado é recusado e nenhuma pendente é aplicada', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq('CREATE TABLE a (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), x int);'),
      '0001_b.sql': arq(tabela('b')),
    })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.divergentes?.map((d) => d.nome)).toEqual(['0000_a.sql'])
    const b = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'b'")
    expect(b[0].n).toBe(0)
  })

  test('falha na última instrução deixa schema e _migracao intactos', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq(tabela('a')),
      '0001_c.sql': arq(`${tabela('c')}\nSELECT 1/0;`),
    })
    await expect(aplicar(banco.urlAdmin, pasta)).rejects.toThrow(/division by zero/)
    const c = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'c'")
    expect(c[0].n).toBe(0)
    const reg = await banco.sql<{ nome: string }>(
      "SELECT nome FROM _migracao WHERE nome IN ('0000_a.sql', '0001_c.sql') ORDER BY nome",
    )
    expect(reg.map((r) => r.nome)).toEqual(['0000_a.sql'])
  })

  test('para no primeiro arquivo que falha e não segue para o seguinte', async () => {
    const pasta = await pastaCom({
      '0000_a.sql': arq(tabela('a')),
      '0001_c.sql': arq('SELECT 1/0;'),
      '0002_d.sql': arq(tabela('d')),
    })
    await expect(aplicar(banco.urlAdmin, pasta)).rejects.toThrow()
    const d = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'd'")
    expect(d[0].n).toBe(0)
  })

  test('checador reprovado recusa antes de tocar no banco', async () => {
    const pasta = await pastaCom({ '0000_a.sql': 'CREATE TABLE z (id int);' })
    const r = await aplicar(banco.urlAdmin, pasta)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problemas?.length).toBeGreaterThan(0)
  })
})

describe('situacao', () => {
  test('lista aplicadas, pendentes e divergentes sem escrever', async () => {
    const pasta = await pastaCom({ '0000_a.sql': arq(tabela('a')), '0001_e.sql': arq(tabela('e')) })
    const antes = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM _migracao')
    const s = await situacao(banco.urlAdmin, pasta)
    expect(s.aplicadas).toEqual(['0000_a.sql'])
    expect(s.pendentes).toEqual(['0001_e.sql'])
    expect(s.divergentes).toEqual([])
    const depois = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM _migracao')
    expect(depois[0].n).toBe(antes[0].n)
  })

  test('banco sem _migracao: tudo pendente', async () => {
    const outro = await criarBancoDeTeste({ semMigracoes: true })
    try {
      const pasta = await pastaCom({ '0000_a.sql': arq('SELECT 1;') })
      const s = await situacao(outro.urlAdmin, pasta)
      expect(s).toEqual({ aplicadas: [], pendentes: ['0000_a.sql'], divergentes: [] })
    } finally {
      await outro.derrubar()
    }
  })
})

describe('_migracao', () => {
  test('inalcançável pelos papéis da aplicação e legível por app_conferencia', async () => {
    const priv = await banco.sql<{ papel: string; le: boolean }>(`
      SELECT r.rolname AS papel, has_table_privilege(r.rolname, '_migracao', 'SELECT') AS le
      FROM pg_roles r WHERE r.rolname IN ('app_conexao', 'app_usuario', 'app_conferencia') ORDER BY 1`)
    expect(priv).toEqual([
      { papel: 'app_conexao', le: false },
      { papel: 'app_conferencia', le: true },
      { papel: 'app_usuario', le: false },
    ])
  })
})

describe('conferirInvariantes', () => {
  test('nomeia tabela de public sem RLS, exceto _migracao', async () => {
    await banco.sql('CREATE TABLE IF NOT EXISTS sem_rls (id uuid PRIMARY KEY DEFAULT gen_random_uuid())')
    const r = await conferirInvariantes(banco.urlAdmin)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.violacoes.join()).toMatch(/sem_rls/)
      expect(r.violacoes.join()).not.toMatch(/_migracao/)
    }
  })

  test('nomeia tabela com FORCE ROW LEVEL SECURITY', async () => {
    await banco.sql('ALTER TABLE sem_rls ENABLE ROW LEVEL SECURITY')
    await banco.sql('ALTER TABLE sem_rls FORCE ROW LEVEL SECURITY')
    const r = await conferirInvariantes(banco.urlAdmin)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.violacoes.join()).toMatch(/FORCE.*sem_rls/)
    await banco.sql('ALTER TABLE sem_rls NO FORCE ROW LEVEL SECURITY')
  })

  test('nomeia tabela sem RLS fora de public', async () => {
    await banco.sql('CREATE SCHEMA IF NOT EXISTS outro')
    await banco.sql('CREATE TABLE IF NOT EXISTS outro.aberta (id uuid PRIMARY KEY DEFAULT gen_random_uuid())')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/sem RLS: outro\.aberta/)
    } finally {
      await banco.sql('DROP TABLE outro.aberta')
    }
  })

  test('nomeia função SECURITY DEFINER sem search_path, em qualquer schema', async () => {
    await banco.sql('CREATE SCHEMA IF NOT EXISTS outro')
    await banco.sql("CREATE FUNCTION outro.perigosa() RETURNS int LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'")
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/outro\.perigosa sem search_path/)
    } finally {
      await banco.sql('DROP FUNCTION outro.perigosa()')
    }
  })

  test('nomeia app_conexao com privilégio de tabela em autenticacao (controle negativo)', async () => {
    await banco.sql('GRANT SELECT ON autenticacao.sessao TO app_conexao')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/app_conexao alcança autenticacao\.sessao/)
    } finally {
      await banco.sql('REVOKE ALL ON autenticacao.sessao FROM app_conexao')
    }
  })

  test('nomeia privilégio concedido direto ao app_teste (controle negativo)', async () => {
    await banco.sql('GRANT SELECT ON usuario TO app_teste')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/app_teste com privilégio concedido direto: public\.usuario/)
    } finally {
      await banco.sql('REVOKE ALL ON usuario FROM app_teste')
    }
  })

  test('nomeia CONNECTION LIMIT divergente do app_teste (controle negativo)', async () => {
    // ALTER ROLE é global no cluster: o finally TEM que restaurar 20, senão o
    // próximo arquivo de teste roda com o limite errado.
    await banco.sql('ALTER ROLE app_teste CONNECTION LIMIT 5')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/app_teste com CONNECTION LIMIT diferente do app_conexao: 5 contra 20/)
    } finally {
      await banco.sql('ALTER ROLE app_teste CONNECTION LIMIT 20')
    }
  })

  test('nomeia política em tabela de autenticacao (controle negativo)', async () => {
    await banco.sql('CREATE POLICY aberta ON autenticacao.sessao FOR SELECT TO app_conexao USING (true)')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/política em autenticacao: aberta/)
    } finally {
      await banco.sql('DROP POLICY aberta ON autenticacao.sessao')
    }
  })

  test('nomeia _migracao alcançável por papel da aplicação (controle negativo)', async () => {
    await banco.sql('GRANT SELECT ON _migracao TO app_usuario')
    const r = await conferirInvariantes(banco.urlAdmin)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.violacoes.join()).toMatch(/_migracao.*app_usuario/)
    await banco.sql('REVOKE ALL ON _migracao FROM app_usuario')
  })

  test('nomeia definidora concedida a app_usuario fora da lista, sem tocar autenticacao (controle negativo)', async () => {
    await banco.sql("CREATE FUNCTION atalho() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT 1'")
    await banco.sql('REVOKE EXECUTE ON FUNCTION atalho() FROM PUBLIC')
    await banco.sql('GRANT EXECUTE ON FUNCTION atalho() TO app_usuario')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/concedida a app_usuario e não registrada: public\.atalho/)
    } finally {
      await banco.sql('DROP FUNCTION atalho()')
    }
  })

  test('nomeia definidora concedida em schema fora de public (controle negativo)', async () => {
    await banco.sql('CREATE SCHEMA IF NOT EXISTS relatorios')
    await banco.sql(
      "CREATE FUNCTION relatorios.espia() RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = '' AS 'SELECT count(*)::int FROM autenticacao.sessao'",
    )
    await banco.sql('REVOKE EXECUTE ON FUNCTION relatorios.espia() FROM PUBLIC')
    await banco.sql('GRANT EXECUTE ON FUNCTION relatorios.espia() TO app_usuario')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/não registrada: relatorios\.espia/)
    } finally {
      await banco.sql('DROP FUNCTION relatorios.espia()')
      await banco.sql('DROP SCHEMA relatorios')
    }
  })

  test('nomeia função registrada sem GRANT (controle negativo)', async () => {
    await banco.sql('REVOKE EXECUTE ON FUNCTION credencial_definir(uuid, text) FROM app_usuario')
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/ausente ou sem GRANT: public\.credencial_definir/)
    } finally {
      await banco.sql('GRANT EXECUTE ON FUNCTION credencial_definir(uuid, text) TO app_usuario')
    }
  })

  test('nomeia função executável por PUBLIC (controle negativo)', async () => {
    await banco.sql("CREATE FUNCTION sem_revoke() RETURNS int LANGUAGE sql AS 'SELECT 1'")
    try {
      const r = await conferirInvariantes(banco.urlAdmin)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.violacoes.join()).toMatch(/executável por PUBLIC: public\.sem_revoke/)
    } finally {
      await banco.sql('DROP FUNCTION sem_revoke()')
    }
  })
})
