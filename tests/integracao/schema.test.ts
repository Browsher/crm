import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { lerMigracoes, PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { checarMigracoes } from '@/src/server/db/migracoes/checar'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

describe('migrações reais', () => {
  test('passam no checador estático', async () => {
    expect(checarMigracoes(await lerMigracoes(PASTA_MIGRACOES))).toEqual({ ok: true })
  })

  test('todas as migrações estão registradas', async () => {
    const r = await banco.sql<{ nome: string }>('SELECT nome FROM _migracao ORDER BY nome')
    expect(r.map((x) => x.nome)).toEqual([
      '0000_papeis.sql',
      '0001_usuario.sql',
      '0002_funcoes_acesso.sql',
      '0003_auditoria.sql',
      '0004_habilitar_rls.sql',
      '0005_politicas_usuario.sql',
      '0006_conexao_sem_heranca.sql',
      '0007_autenticacao.sql',
      '0008_senha_provisoria.sql',
      '0009_funcoes_autenticacao.sql',
      '0010_congelar_marca_provisoria.sql',
      '0011_funcoes_usuario.sql',
      '0012_situacao_e_auditoria.sql',
      '0013_cep.sql',
      '0014_empresa.sql',
      '0015_empresa_busca.sql',
      '0016_empresa_fila.sql',
      '0017_contato.sql',
      '0018_contato_registrar.sql',
      '0019_fila_interna.sql',
      '0020_usuario_publico.sql',
      '0021_papel_teste.sql',
      '0022_credencial_vigente.sql',
      '0023_empresa_cnae.sql',
      '0024_empresa_consulta.sql',
    ])
  })

  test('invariantes valem', async () => {
    expect(await conferirInvariantes(banco.urlAdmin)).toEqual({ ok: true })
  })

  test('usuario tem RLS sem FORCE e três políticas, nenhuma de DELETE', async () => {
    const t = await banco.sql<{ rls: boolean; force: boolean }>(
      "SELECT relrowsecurity AS rls, relforcerowsecurity AS force FROM pg_class WHERE relname = 'usuario'",
    )
    expect(t[0]).toEqual({ rls: true, force: false })
    const p = await banco.sql<{ nome: string; cmd: string }>(
      "SELECT policyname AS nome, cmd FROM pg_policies WHERE tablename = 'usuario' ORDER BY 1",
    )
    expect(p).toEqual([
      { nome: 'usuario_alterar', cmd: 'UPDATE' },
      { nome: 'usuario_criar', cmd: 'INSERT' },
      { nome: 'usuario_ler', cmd: 'SELECT' },
    ])
  })

  test('app_usuario não tem DELETE em usuario', async () => {
    const r = await banco.sql<{ pode: boolean }>(
      "SELECT has_table_privilege('app_usuario', 'usuario', 'DELETE') AS pode",
    )
    expect(r[0].pode).toBe(false)
  })

  test('e-mail fora do padrão e papel desconhecido são recusados pelo CHECK', async () => {
    const inserir = (email: string, papel: string) =>
      banco.sql("INSERT INTO usuario (nome, email, papel) VALUES ('A', $1, $2)", [email, papel])
    await expect(inserir('Fulano@X.com', 'gestor')).rejects.toThrow(/check/i)
    await expect(inserir(' a@x.com', 'gestor')).rejects.toThrow(/check/i)
    await expect(inserir('a@x.com', 'admin')).rejects.toThrow(/check/i)
  })

  test('funções de acesso: PUBLIC não executa, app_usuario executa', async () => {
    // app_conferencia representa "qualquer outro papel": se PUBLIC tivesse EXECUTE, ele teria.
    for (const f of ['usuario_atual()', 'pode_ler()', 'eh_gestor()', 'pode_escrever()', 'senha_provisoria_de(uuid)']) {
      const r = await banco.sql<{ pub: boolean; app: boolean }>(
        `SELECT has_function_privilege('app_usuario', '${f}', 'EXECUTE') AS app,
                has_function_privilege('app_conferencia', '${f}', 'EXECUTE') AS pub`,
      )
      expect(r[0]).toEqual({ app: true, pub: false })
    }
  })
})
