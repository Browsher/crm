import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { repositorioPostgres } from '@/src/features/usuarios/repositorio'
import { entrar } from '@/src/server/autenticacao/entrar'
import { gerarHash } from '@/src/server/autenticacao/senha'
import { criarSessao, lerSessao } from '@/src/server/autenticacao/sessao'
// `criarUsuario` do harness ganha apelido: o serviço exporta um `criarUsuario` também.
import { criarBancoDeTeste, criarUsuario as criarNaTabela, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let hash: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarNaTabela(banco, 'gestor', 'Gestora')
  vendedor = await criarNaTabela(banco, 'vendedor', 'Vendedor')
  hash = await gerarHash('provisoria-1')
})
afterAll(async () => {
  await banco.derrubar()
})

const NADA = '00000000-0000-0000-0000-000000000000'

describe('repositorioPostgres', () => {
  test('criar: usuário e credencial na mesma transação; senha entra; pendente', async () => {
    const repo = repositorioPostgres(gestor)
    const r = await repo.criar({ nome: 'Nova', email: 'nova@teste.local', papel: 'vendedor' }, hash)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [u] = await banco.sql<{ p: boolean; criado_por: string }>(
      'SELECT senha_provisoria_pendente AS p, criado_por FROM usuario WHERE id = $1',
      [r.id],
    )
    expect(u).toEqual({ p: true, criado_por: gestor })
    expect(await entrar({ email: 'nova@teste.local', senha: 'provisoria-1', origem: null })).toMatchObject({ ok: true, precisaTrocarSenha: true })
  })

  test('criar com e-mail repetido: email_em_uso, e nenhum usuário pela metade', async () => {
    const repo = repositorioPostgres(gestor)
    const r = await repo.criar({ nome: 'Dup', email: 'nova@teste.local', papel: 'vendedor' }, hash)
    expect(r).toEqual({ ok: false, motivo: 'email_em_uso' })
    const n = await banco.sql("SELECT 1 FROM usuario WHERE nome = 'Dup'")
    expect(n).toEqual([])
  })

  test('vendedor não cria: sem_permissao', async () => {
    const repo = repositorioPostgres(vendedor)
    expect(await repo.criar({ nome: 'X', email: 'x@teste.local', papel: 'vendedor' }, hash)).toEqual({ ok: false, motivo: 'sem_permissao' })
  })

  test('definirCredencial: sucesso, inexistente, sem permissão', async () => {
    expect(await repositorioPostgres(gestor).definirCredencial(vendedor, hash)).toEqual({ ok: true })
    expect(await repositorioPostgres(gestor).definirCredencial(NADA, hash)).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await repositorioPostgres(vendedor).definirCredencial(gestor, hash)).toEqual({ ok: false, motivo: 'sem_permissao' })
  })

  test('alterar papel e ativo; inexistente é nao_encontrado; vendedor não altera', async () => {
    const repo = repositorioPostgres(gestor)
    expect(await repo.alterar(vendedor, { papel: 'gestor' })).toEqual({ ok: true })
    const [a] = await banco.sql<{ papel: string }>('SELECT papel FROM usuario WHERE id = $1', [vendedor])
    expect(a.papel).toBe('gestor')
    expect(await repo.alterar(vendedor, { papel: 'vendedor' })).toEqual({ ok: true })
    expect(await repo.alterar(NADA, { ativo: true })).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await repositorioPostgres(vendedor).alterar(gestor, { ativo: false })).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  test('desativar apaga as sessões na mesma transação; reativar não as traz de volta', async () => {
    const alvo = await criarNaTabela(banco, 'vendedor', 'Alvo')
    const { token } = await criarSessao(alvo)
    const repo = repositorioPostgres(gestor)
    expect(await repo.desativar(alvo)).toEqual({ ok: true })
    const [{ n }] = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM autenticacao.sessao WHERE usuario_id = $1', [alvo])
    expect(n).toBe(0)
    expect(await repo.alterar(alvo, { ativo: true })).toEqual({ ok: true })
    expect(await lerSessao(token)).toBeNull()
    expect(await repo.desativar(NADA)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  test('listar: gestor vê todos, ativos primeiro, por nome; vendedor vê só a si', async () => {
    const lista = await repositorioPostgres(gestor).listar()
    expect(lista.length).toBeGreaterThanOrEqual(3)
    const ativos = lista.filter((u) => u.ativo).map((u) => u.nome)
    expect(ativos).toEqual([...ativos].sort((a, b) => a.localeCompare(b)))
    expect(lista[0]).toMatchObject({ ativo: true })
    const so = await repositorioPostgres(vendedor).listar()
    expect(so.map((u) => u.id)).toEqual([vendedor])
  })
})
