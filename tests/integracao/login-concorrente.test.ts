import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import { Client } from 'pg'
import { setTimeout as esperar } from 'node:timers/promises'
import { entrar } from '@/src/server/autenticacao/entrar'
import { criarSessao, hashDoToken } from '@/src/server/autenticacao/sessao'
import { chamar } from '@/src/server/db/sem-identidade'
import { criarBancoDeTeste, criarUsuario, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

const intervalo = vi.hoisted(() => ({ depoisDeLer: undefined as (() => Promise<void>) | undefined }))
vi.mock('@/src/server/db/sem-identidade', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/src/server/db/sem-identidade')>()
  return {
    ...real,
    chamar: async (...args: Parameters<typeof real.chamar>) => {
      const linhas = await real.chamar(...args)
      if (args[0] === 'credencial_por_email' && intervalo.depoisDeLer) {
        const executar = intervalo.depoisDeLer
        intervalo.depoisDeLer = undefined
        await executar()
      }
      return linhas
    },
  }
})

let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco.derrubar() })

let numero = 0
async function contas() {
  const n = ++numero
  const gestor = await criarUsuario(banco, 'gestor', `Gestor${n}`)
  const alvo = await criarUsuarioComSenha(banco, 'vendedor', `Alvo${n}`, 'senha-antiga', { pendente: true })
  return { gestor, alvo }
}

const emitir = (c: Client, id: string, token: string, versao: string | null = '1') =>
  c.query('SELECT * FROM autenticacao.sessao_criar($1, $2, now() + interval \'1 hour\', $3)', [id, token, versao])

async function conectar(gestor?: string) {
  const c = new Client({ connectionString: banco.urlApp, ssl: false })
  await c.connect()
  await c.query('BEGIN')
  await c.query("SET LOCAL statement_timeout = '8s'")
  if (gestor) await c.query("SELECT set_config('app.usuario_id', $1, true), set_config('role', 'app_usuario', true)", [gestor])
  const { rows: [{ pid }] } = await c.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
  return { c, pid }
}

async function esperarTrava(bloqueado: number, bloqueador: number) {
  const prazo = Date.now() + 4000
  while (Date.now() < prazo) {
    const [{ pids }] = await banco.sql<{ pids: number[] }>('SELECT pg_blocking_pids($1) AS pids', [bloqueado])
    if (pids.includes(bloqueador)) return
    await esperar(10)
  }
  throw new Error(`conexão ${bloqueado} não esperou por ${bloqueador}`)
}

test('titular revoga a credencial lida pelo login e conserva somente a sessão da troca', async () => {
  const { alvo } = await contas()
  const atual = await criarSessao(alvo.id, '1')
  if (!atual.ok) throw new Error('sessão recusada')
  intervalo.depoisDeLer = async () => { await chamar('senha_trocar', [hashDoToken(atual.token), 'novo']) }
  expect(await entrar({ email: alvo.email, senha: 'senha-antiga', origem: null }))
    .toEqual({ ok: false, motivo: 'credenciais_invalidas' })
  expect(await banco.sql('SELECT token_hash FROM autenticacao.sessao WHERE usuario_id = $1', [alvo.id]))
    .toEqual([{ token_hash: hashDoToken(atual.token) }])
  expect(await banco.sql('SELECT sucesso FROM autenticacao.tentativa_login WHERE email = $1', [alvo.email]))
    .toEqual([{ sucesso: false }])
})

test('versão bigint permanece exata no login e a marca provisória vem da emissão final', async () => {
  const { alvo } = await contas()
  await banco.sql("UPDATE autenticacao.credencial SET versao = '9007199254740993' WHERE usuario_id = $1", [alvo.id])
  intervalo.depoisDeLer = async () => { await banco.sql('UPDATE usuario SET senha_provisoria_pendente = false WHERE id = $1', [alvo.id]) }
  expect(await entrar({ email: alvo.email, senha: 'senha-antiga', origem: null }))
    .toMatchObject({ ok: true, precisaTrocarSenha: false })
  expect(await criarSessao(alvo.id, '9007199254740992')).toEqual({ ok: false })
})

test('versão ausente ou incorreta, credencial ausente e usuário inativo não recebem sessão', async () => {
  const { alvo } = await contas()
  const semCredencial = await criarUsuario(banco, 'vendedor', 'SemCredencial')
  for (const [id, versao] of [[alvo.id, null], [alvo.id, '2'], [semCredencial, '1']] as const) {
    expect(await chamar('sessao_criar', [id, `negado-${id}-${versao}`, new Date(Date.now() + 60_000), versao])).toEqual([])
  }
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [alvo.id])
  expect(await criarSessao(alvo.id, '1')).toEqual({ ok: false })
  expect(await banco.sql('SELECT * FROM autenticacao.sessao WHERE usuario_id = ANY($1)', [[alvo.id, semCredencial]])).toEqual([])
})

for (const tipo of ['titular', 'gestor', 'desativacao'] as const) {
  for (const primeira of ['revogacao', 'emissao'] as const) {
    test(`${tipo}: ${primeira} primeiro serializa e não deixa sessão emitida sobreviver`, async () => {
      const { gestor, alvo } = await contas()
      await chamar('sessao_criar', [alvo.id, `atual-${alvo.id}`, new Date(Date.now() + 60_000), '1'])
      const emissor = await conectar()
      const revogador = await conectar(tipo === 'titular' ? undefined : gestor)
      const revogar = () => tipo === 'titular'
        ? revogador.c.query('SELECT autenticacao.senha_trocar($1, $2)', [`atual-${alvo.id}`, 'novo'])
        : tipo === 'gestor'
          ? revogador.c.query('SELECT credencial_definir($1, $2)', [alvo.id, 'novo'])
          : revogador.c.query('SELECT usuario_situacao_definir($1, false)', [alvo.id])
      try {
        if (primeira === 'revogacao') {
          await revogar()
          // Handler imediato impede rejeição não observada caso a espera falhe.
          const pendente = emitir(emissor.c, alvo.id, `nova-${alvo.id}`).then(r => ({ r }), erro => ({ erro }))
          await esperarTrava(emissor.pid, revogador.pid)
          await revogador.c.query('COMMIT')
          const resultado = await pendente
          if ('erro' in resultado) throw resultado.erro
          expect(resultado.r.rows).toEqual([])
          await emissor.c.query('COMMIT')
        } else {
          expect((await emitir(emissor.c, alvo.id, `nova-${alvo.id}`)).rows).toHaveLength(1)
          const pendente = revogar().then(r => ({ r }), erro => ({ erro }))
          await esperarTrava(revogador.pid, emissor.pid)
          await emissor.c.query('COMMIT')
          const resultado = await pendente
          if ('erro' in resultado) throw resultado.erro
          await revogador.c.query('COMMIT')
        }
        expect(await banco.sql('SELECT token_hash FROM autenticacao.sessao WHERE usuario_id = $1', [alvo.id]))
          .toEqual(tipo === 'titular' ? [{ token_hash: `atual-${alvo.id}` }] : [])
      } finally {
        await emissor.c.query('ROLLBACK')
        await revogador.c.query('ROLLBACK')
        await emissor.c.end()
        await revogador.c.end()
      }
    })
  }
}

test('rollback da redefinição permite emissão da versão anterior depois da espera', async () => {
  const { gestor, alvo } = await contas()
  const a = await conectar(gestor)
  const b = await conectar()
  try {
    await a.c.query('SELECT credencial_definir($1, $2)', [alvo.id, 'novo'])
    const pendente = emitir(b.c, alvo.id, 'rollback').then(r => ({ r }), erro => ({ erro }))
    await esperarTrava(b.pid, a.pid)
    await a.c.query('ROLLBACK')
    const resultado = await pendente
    if ('erro' in resultado) throw resultado.erro
    expect(resultado.r.rows).toEqual([{ senha_provisoria_pendente: true }])
    await b.c.query('COMMIT')
    expect(await banco.sql('SELECT versao FROM autenticacao.credencial WHERE usuario_id = $1', [alvo.id])).toEqual([{ versao: '1' }])
  } finally {
    await a.c.query('ROLLBACK')
    await b.c.query('ROLLBACK')
    await a.c.end()
    await b.c.end()
  }
})

test('mesmo hash e A → B → A incrementam versão e revogam a versão anterior', async () => {
  const { gestor, alvo } = await contas()
  for (const [hash, versao] of [['A', '2'], ['A', '3'], ['B', '4'], ['A', '5']]) {
    await banco.comoUsuario(gestor, sql => sql('SELECT credencial_definir($1, $2)', [alvo.id, hash]))
    expect(await banco.sql('SELECT versao FROM autenticacao.credencial WHERE usuario_id = $1', [alvo.id])).toEqual([{ versao }])
    expect(await criarSessao(alvo.id, String(BigInt(versao) - BigInt(1)))).toEqual({ ok: false })
  }
  expect(await criarSessao(alvo.id, '2')).toEqual({ ok: false })
  expect(await criarSessao(alvo.id, '5')).toMatchObject({ ok: true, precisaTrocarSenha: true })
})

test('assinatura antiga ausente e funções recriadas mantêm dono e privilégios restritos', async () => {
  const [antiga] = await banco.sql<{ assinatura: string | null }>("SELECT to_regprocedure('autenticacao.sessao_criar(uuid,text,timestamptz)')::text AS assinatura")
  expect(antiga.assinatura).toBeNull()
  const linhas = await banco.sql(`SELECT p.proname AS nome, p.proowner = c.relowner AS mesmo_dono,
    p.prosecdef AS definidora, p.proconfig AS config,
    has_function_privilege('app_conexao', p.oid, 'EXECUTE') AS conexao,
    has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario,
    EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS publico
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN pg_class c WHERE c.oid = 'autenticacao.credencial'::regclass
    AND n.nspname = 'autenticacao' AND p.proname IN ('credencial_por_email', 'sessao_criar') ORDER BY p.proname`)
  expect(linhas).toEqual(['credencial_por_email', 'sessao_criar'].map(nome => ({ nome, mesmo_dono: true, definidora: true, config: ['search_path=""'], conexao: true, usuario: false, publico: false })))
})

test('login não emite sessão quando gestor revoga a credencial depois da leitura', async () => {
  const gestor = await criarUsuarioComSenha(banco, 'gestor', 'Gestor', 'senha-gestor')
  const alvo = await criarUsuarioComSenha(banco, 'vendedor', 'Alvo', 'senha-antiga')
  intervalo.depoisDeLer = () => banco.comoUsuario(gestor.id, async (sql) => {
    await sql('SELECT credencial_definir($1, $2)', [alvo.id, 'hash-novo'])
  })
  expect(await entrar({ email: alvo.email, senha: 'senha-antiga', origem: null }))
    .toEqual({ ok: false, motivo: 'credenciais_invalidas' })
  expect(await banco.sql('SELECT * FROM autenticacao.sessao WHERE usuario_id = $1', [alvo.id])).toEqual([])
  expect(await banco.sql('SELECT sucesso FROM autenticacao.tentativa_login WHERE email = $1', [alvo.email]))
    .toEqual([{ sucesso: false }])
})
