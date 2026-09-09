import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { gerarHash } from '@/src/server/autenticacao/senha'
import { criarSessao, hashDoToken, lerSessao } from '@/src/server/autenticacao/sessao'
import { FUNCOES_DE_USUARIO_EM_AUTENTICACAO } from '@/src/server/db/migracoes/invariantes'
import { chamar } from '@/src/server/db/sem-identidade'
import { criarBancoDeTeste, criarUsuario, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestora')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
})
afterAll(async () => {
  await banco.derrubar()
})

const definir = (quem: string, alvo: string, hash: string) =>
  banco.comoUsuario(quem, (e) => e<{ credencial_definir: boolean }>('SELECT credencial_definir($1, $2)', [alvo, hash]))
const situacao = (quem: string, alvo: string, ativo: boolean) =>
  banco.comoUsuario(quem, (e) =>
    e<{ usuario_situacao_definir: string }>('SELECT usuario_situacao_definir($1, $2)', [alvo, ativo]),
  )
const sessoesDe = async (id: string) => {
  const [{ n }] = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM autenticacao.sessao WHERE usuario_id = $1', [id])
  return n
}

describe('credencial_definir', () => {
  test('gestor define: credencial entra, marca sobe, sessões do alvo somem, atualizado_por é o gestor', async () => {
    const { token } = await criarSessao(vendedor)
    const hash = await gerarHash('provisoria-1')
    const r = await definir(gestor, vendedor, hash)
    expect(r.linhas).toEqual([{ credencial_definir: 'ok' }])
    const [u] = await banco.sql<{ p: boolean; por: string }>(
      'SELECT senha_provisoria_pendente AS p, atualizado_por AS por FROM usuario WHERE id = $1',
      [vendedor],
    )
    expect(u).toEqual({ p: true, por: gestor })
    expect(await sessoesDe(vendedor)).toBe(0)
    expect(await lerSessao(token)).toBeNull()
    expect(await entrar({ email: 'vendedor@teste.local', senha: 'provisoria-1', origem: null })).toMatchObject({ ok: true, precisaTrocarSenha: true })
  })

  test('segunda chamada substitui o hash: a antiga não entra, a nova entra', async () => {
    const hash = await gerarHash('provisoria-2')
    await definir(gestor, vendedor, hash)
    expect(await entrar({ email: 'vendedor@teste.local', senha: 'provisoria-1', origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
    expect(await entrar({ email: 'vendedor@teste.local', senha: 'provisoria-2', origem: null })).toMatchObject({ ok: true })
  })

  test('alvo inexistente devolve nao_encontrado e não cria credencial', async () => {
    const r = await definir(gestor, '00000000-0000-0000-0000-000000000000', 'x')
    expect(r.linhas).toEqual([{ credencial_definir: 'nao_encontrado' }])
    const c = await banco.sql("SELECT 1 FROM autenticacao.credencial WHERE senha_hash = 'x'")
    expect(c).toEqual([])
  })

  test('vendedor recebe 42501', async () => {
    await expect(definir(vendedor, gestor, 'x')).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor sobre si mesmo recebe 42501', async () => {
    await expect(definir(gestor, gestor, 'x')).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor pendente recebe 42501', async () => {
    const pendente = await criarUsuario(banco, 'gestor', 'Pendente')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
    await expect(definir(pendente, vendedor, 'x')).rejects.toMatchObject({ code: '42501' })
  })

  test('gestor inativo recebe 42501', async () => {
    const inativo = await criarUsuario(banco, 'gestor', 'Inativa')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [inativo])
    await expect(definir(inativo, vendedor, 'x')).rejects.toMatchObject({ code: '42501' })
  })
})

describe('usuario_situacao_definir', () => {
  test('vendedor e gestor sobre si recebem 42501', async () => {
    await expect(situacao(vendedor, gestor, false)).rejects.toMatchObject({ code: '42501' })
    await expect(situacao(gestor, gestor, false)).rejects.toMatchObject({ code: '42501' })
  })

  test('desativar apaga as sessões do alvo e derruba o login', async () => {
    const { id, email } = await criarUsuarioComSenha(banco, 'vendedor', 'Demitido', 'senha-forte-1')
    const { token } = await criarSessao(id)
    const r = await situacao(gestor, id, false)
    expect(r.linhas).toEqual([{ usuario_situacao_definir: 'ok' }])
    expect(await lerSessao(token)).toBeNull()
    expect(await sessoesDe(id)).toBe(0)
    expect(await entrar({ email, senha: 'senha-forte-1', origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
  })

  test('reativar não apaga sessão de ninguém', async () => {
    const outro = await criarUsuario(banco, 'vendedor', 'Intocado')
    const { token } = await criarSessao(outro)
    const alvo = await criarUsuario(banco, 'vendedor', 'Reativado')
    await situacao(gestor, alvo, false)
    await situacao(gestor, alvo, true)
    expect(await lerSessao(token)).not.toBeNull()
  })
})

describe('vocabulário de retorno', () => {
  test('credencial_definir devolve ok, nao_encontrado e alvo_inativo, com a string exata', async () => {
    const vivo = await criarUsuario(banco, 'vendedor', 'Vivo')
    expect((await definir(gestor, vivo, 'h')).linhas).toEqual([{ credencial_definir: 'ok' }])
    expect((await definir(gestor, '00000000-0000-0000-0000-000000000000', 'h')).linhas).toEqual([
      { credencial_definir: 'nao_encontrado' },
    ])
    const morto = await criarUsuario(banco, 'vendedor', 'Morto')
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [morto])
    expect((await definir(gestor, morto, 'h')).linhas).toEqual([{ credencial_definir: 'alvo_inativo' }])
  })

  test('usuario_situacao_definir devolve ok, nao_encontrado e ja_nesse_estado, com a string exata', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'Situacao')
    expect((await situacao(gestor, alvo, false)).linhas).toEqual([{ usuario_situacao_definir: 'ok' }])
    expect((await situacao(gestor, alvo, false)).linhas).toEqual([{ usuario_situacao_definir: 'ja_nesse_estado' }])
    expect((await situacao(gestor, '00000000-0000-0000-0000-000000000000', true)).linhas).toEqual([
      { usuario_situacao_definir: 'nao_encontrado' },
    ])
    expect((await situacao(gestor, alvo, true)).linhas).toEqual([{ usuario_situacao_definir: 'ok' }])
    expect((await situacao(gestor, alvo, true)).linhas).toEqual([{ usuario_situacao_definir: 'ja_nesse_estado' }])
  })
})

describe('auditoria de quem redefiniu', () => {
  test('dois gestores em sequência: a credencial nomeia o segundo', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'Auditado')
    const gestor2 = await criarUsuario(banco, 'gestor', 'GestoraDois')
    await definir(gestor, alvo, 'hash-do-primeiro')
    const [a] = await banco.sql<{ por: string }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1',
      [alvo],
    )
    expect(a.por).toBe(gestor)
    await definir(gestor2, alvo, 'hash-do-segundo')
    const [b] = await banco.sql<{ por: string; hash: string }>(
      'SELECT atualizado_por AS por, senha_hash AS hash FROM autenticacao.credencial WHERE usuario_id = $1',
      [alvo],
    )
    expect(b).toEqual({ por: gestor2, hash: 'hash-do-segundo' })
  })

  test('senha_trocar grava o próprio usuário', async () => {
    const { id } = await criarUsuarioComSenha(banco, 'vendedor', 'Trocador', 'senha-forte-1')
    const { token } = await criarSessao(id)
    await chamar('senha_trocar', [hashDoToken(token), 'hash-novo'])
    const [c] = await banco.sql<{ por: string }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1',
      [id],
    )
    expect(c.por).toBe(id)
  })

  test('credencial criada como dona fica com atualizado_por nulo (caminho do seed)', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Semeado')
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'h'])
    const [c] = await banco.sql<{ por: string | null }>(
      'SELECT atualizado_por AS por FROM autenticacao.credencial WHERE usuario_id = $1',
      [id],
    )
    expect(c.por).toBeNull()
  })
})

describe('lista fechada', () => {
  test('privilégios depois da 0012', async () => {
    const r = await banco.sql<{ nome: string; usuario: boolean; conexao: boolean; publico: boolean }>(`
      SELECT p.proname AS nome,
             has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario,
             has_function_privilege('app_conexao', p.oid, 'EXECUTE') AS conexao,
             (p.proacl IS NULL OR EXISTS (
               SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')) AS publico
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('credencial_definir', 'usuario_situacao_definir', 'sessoes_encerrar_de', 'exigir_gestor', 'definir_auditoria')
      ORDER BY 1`)
    expect(r).toEqual([
      { nome: 'credencial_definir', usuario: true, conexao: false, publico: false },
      { nome: 'definir_auditoria', usuario: false, conexao: false, publico: false },
      { nome: 'exigir_gestor', usuario: false, conexao: false, publico: false },
      { nome: 'sessoes_encerrar_de', usuario: false, conexao: false, publico: false },
      { nome: 'usuario_situacao_definir', usuario: true, conexao: false, publico: false },
    ])
  })

  test('as listas são uma: constante = definidoras de public que tocam autenticacao com EXECUTE para app_usuario', async () => {
    const r = await banco.sql<{ nome: string }>(`
      SELECT p.proname AS nome FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef AND p.prosrc LIKE '%autenticacao.%'
        AND has_function_privilege('app_usuario', p.oid, 'EXECUTE') ORDER BY 1`)
    expect(r.map((f) => f.nome)).toEqual([...FUNCOES_DE_USUARIO_EM_AUTENTICACAO].sort())
  })
})
