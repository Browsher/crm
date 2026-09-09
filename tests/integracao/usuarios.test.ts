import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { repositorioPostgres } from '@/src/features/usuarios/repositorio'
import { criarUsuario, desativar, mudarPapel, novaSenhaProvisoria, reativar } from '@/src/features/usuarios/servico'
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

  test('mudarPapel; inexistente é nao_encontrado; vendedor não altera', async () => {
    const repo = repositorioPostgres(gestor)
    expect(await repo.mudarPapel(vendedor, 'gestor')).toEqual({ ok: true })
    const [a] = await banco.sql<{ papel: string }>('SELECT papel FROM usuario WHERE id = $1', [vendedor])
    expect(a.papel).toBe('gestor')
    expect(await repo.mudarPapel(vendedor, 'vendedor')).toEqual({ ok: true })
    expect(await repo.mudarPapel(NADA, 'vendedor')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await repositorioPostgres(vendedor).mudarPapel(gestor, 'vendedor')).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })

  test('desativar apaga as sessões na mesma transação; reativar não as traz de volta', async () => {
    const alvo = await criarNaTabela(banco, 'vendedor', 'Alvo')
    const { token } = await criarSessao(alvo)
    const repo = repositorioPostgres(gestor)
    expect(await repo.definirSituacao(alvo, false)).toEqual({ ok: true })
    const [{ n }] = await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM autenticacao.sessao WHERE usuario_id = $1', [alvo])
    expect(n).toBe(0)
    expect(await repo.definirSituacao(alvo, true)).toEqual({ ok: true })
    expect(await lerSessao(token)).toBeNull()
    expect(await repo.definirSituacao(NADA, false)).toEqual({ ok: false, motivo: 'nao_encontrado' })
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

describe('serviço com repositório real', () => {
  test('criarUsuario: senha devolvida entra e cai em pendente', async () => {
    const r = await criarUsuario(repositorioPostgres(gestor), { nome: ' Bia ', email: 'Bia@Teste.local', papel: 'vendedor' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.senhaProvisoria).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
    expect(await entrar({ email: 'bia@teste.local', senha: r.senhaProvisoria, origem: null })).toMatchObject({ ok: true, precisaTrocarSenha: true })
  })

  test('0010 pelo caminho da fatia: depois de criar, o gestor não zera a marca por UPDATE', async () => {
    const r = await criarUsuario(repositorioPostgres(gestor), { nome: 'Caio', email: 'caio@teste.local', papel: 'vendedor' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await expect(
      banco.comoUsuario(gestor, (e) => e('UPDATE usuario SET senha_provisoria_pendente = false WHERE id = $1', [r.id])),
    ).rejects.toMatchObject({ code: '42501' })
  })

  test('e-mail repetido: email_em_uso', async () => {
    expect(await criarUsuario(repositorioPostgres(gestor), { nome: 'Bia2', email: 'bia@teste.local', papel: 'vendedor' })).toEqual({
      ok: false,
      motivo: 'email_em_uso',
    })
  })

  test('novaSenhaProvisoria: a antiga não entra, a nova entra, sessão antiga morre', async () => {
    const criado = await criarUsuario(repositorioPostgres(gestor), { nome: 'Dani', email: 'dani@teste.local', papel: 'vendedor' })
    if (!criado.ok) throw new Error('criação falhou')
    const { token } = await criarSessao(criado.id)
    const r = await novaSenhaProvisoria(repositorioPostgres(gestor), criado.id)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(await lerSessao(token)).toBeNull()
    expect(await entrar({ email: 'dani@teste.local', senha: criado.senhaProvisoria, origem: null })).toEqual({ ok: false, motivo: 'credenciais_invalidas' })
    expect(await entrar({ email: 'dani@teste.local', senha: r.senhaProvisoria, origem: null })).toMatchObject({ ok: true })
  })

  test('mudarPapel, desativar, reativar', async () => {
    const repo = repositorioPostgres(gestor)
    const alvo = await criarNaTabela(banco, 'vendedor', 'Edu')
    expect(await mudarPapel(repo, alvo, 'gestor')).toEqual({ ok: true })
    expect(await desativar(repo, alvo)).toEqual({ ok: true })
    const [d] = await banco.sql<{ ativo: boolean; papel: string }>('SELECT ativo, papel FROM usuario WHERE id = $1', [alvo])
    expect(d).toEqual({ ativo: false, papel: 'gestor' })
    expect(await reativar(repo, alvo)).toEqual({ ok: true })
    const [v] = await banco.sql<{ ativo: boolean }>('SELECT ativo FROM usuario WHERE id = $1', [alvo])
    expect(v.ativo).toBe(true)
  })

  test('definirSituacao recusa transição sem sentido, com motivo próprio', async () => {
    const repo = repositorioPostgres(gestor)
    const alvo = await criarNaTabela(banco, 'vendedor', 'Transicao')
    expect(await repo.definirSituacao(alvo, false)).toEqual({ ok: true })
    expect(await repo.definirSituacao(alvo, false)).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
    expect(await repo.definirCredencial(alvo, hash)).toEqual({ ok: false, motivo: 'alvo_inativo' })
    expect(await repo.definirSituacao(alvo, true)).toEqual({ ok: true })
    expect(await repo.definirSituacao(alvo, true)).toEqual({ ok: false, motivo: 'ja_nesse_estado' })
  })

  test('vendedor em qualquer operação: sem_permissao ou nao_encontrado; inexistente: nao_encontrado', async () => {
    const repo = repositorioPostgres(vendedor)
    expect(await criarUsuario(repo, { nome: 'F', email: 'f@teste.local', papel: 'vendedor' })).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(await novaSenhaProvisoria(repo, gestor)).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(await mudarPapel(repo, gestor, 'vendedor')).toEqual({ ok: false, motivo: 'nao_encontrado' })
    expect(await desativar(repo, gestor)).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(await reativar(repositorioPostgres(gestor), NADA)).toEqual({ ok: false, motivo: 'nao_encontrado' })
  })
})
