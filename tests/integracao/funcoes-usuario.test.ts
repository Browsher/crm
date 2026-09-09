import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { gerarHash } from '@/src/server/autenticacao/senha'
import { criarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
import { FUNCOES_DE_USUARIO_EM_AUTENTICACAO } from '@/src/server/db/migracoes/invariantes'
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
const encerrar = (quem: string, alvo: string) =>
  banco.comoUsuario(quem, (e) => e<{ sessoes_encerrar_de: number }>('SELECT sessoes_encerrar_de($1)', [alvo]))
const sessoesDe = async (id: string) => {
  const [{ n }] = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM autenticacao.sessao WHERE usuario_id = $1', [id])
  return n
}

describe('credencial_definir', () => {
  test('gestor define: credencial entra, marca sobe, sessões do alvo somem, atualizado_por é o gestor', async () => {
    const { token } = await criarSessao(vendedor)
    const hash = await gerarHash('provisoria-1')
    const r = await definir(gestor, vendedor, hash)
    expect(r.linhas).toEqual([{ credencial_definir: true }])
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

  test('alvo inexistente devolve false e não cria credencial', async () => {
    const r = await definir(gestor, '00000000-0000-0000-0000-000000000000', 'x')
    expect(r.linhas).toEqual([{ credencial_definir: false }])
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

describe('sessoes_encerrar_de', () => {
  test('apaga só as sessões do alvo e devolve quantas', async () => {
    const alvo = await criarUsuario(banco, 'vendedor', 'Alvo')
    const outro = await criarUsuario(banco, 'vendedor', 'Outro')
    await criarSessao(alvo)
    await criarSessao(alvo)
    const { token } = await criarSessao(outro)
    const r = await encerrar(gestor, alvo)
    expect(r.linhas).toEqual([{ sessoes_encerrar_de: 2 }])
    expect(await sessoesDe(alvo)).toBe(0)
    expect(await lerSessao(token)).not.toBeNull()
  })

  test('vendedor e gestor sobre si recebem 42501', async () => {
    await expect(encerrar(vendedor, gestor)).rejects.toMatchObject({ code: '42501' })
    await expect(encerrar(gestor, gestor)).rejects.toMatchObject({ code: '42501' })
  })

  test('desativar e encerrar na mesma transação: sessao_atual zero linhas e zero linhas em sessao', async () => {
    const { id, email } = await criarUsuarioComSenha(banco, 'vendedor', 'Demitido', 'senha-forte-1')
    const { token } = await criarSessao(id)
    await banco.comoUsuario(gestor, async (e) => {
      const u = await e('UPDATE usuario SET ativo = false WHERE id = $1', [id])
      expect(u.afetadas).toBe(1)
      await e('SELECT sessoes_encerrar_de($1)', [id])
    })
    expect(await lerSessao(token)).toBeNull()
    expect(await sessoesDe(id)).toBe(0)
    expect(await entrar({ email, senha: 'senha-forte-1', origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
  })
})

describe('lista fechada', () => {
  test('app_conexao e app_conferencia não executam as duas; app_usuario executa', async () => {
    const r = await banco.sql<{ nome: string; usuario: boolean; conexao: boolean; conferencia: boolean }>(`
      SELECT p.proname AS nome,
             has_function_privilege('app_usuario', p.oid, 'EXECUTE') AS usuario,
             has_function_privilege('app_conexao', p.oid, 'EXECUTE') AS conexao,
             has_function_privilege('app_conferencia', p.oid, 'EXECUTE') AS conferencia
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('credencial_definir', 'sessoes_encerrar_de') ORDER BY 1`)
    expect(r).toEqual([
      { nome: 'credencial_definir', usuario: true, conexao: false, conferencia: false },
      { nome: 'sessoes_encerrar_de', usuario: true, conexao: false, conferencia: false },
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
