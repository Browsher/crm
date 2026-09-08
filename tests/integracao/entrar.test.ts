import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { lerSessao } from '@/src/server/autenticacao/sessao'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  await criarUsuarioComSenha(banco, 'vendedor', 'Ana', 'senha-da-ana')
  await criarUsuarioComSenha(banco, 'gestor', 'Novo', 'provisoria-1', { pendente: true })
  const inativo = await criarUsuarioComSenha(banco, 'vendedor', 'Saiu', 'senha-do-saiu')
  await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [inativo.id])
})
afterAll(async () => {
  await banco.derrubar()
})

const INVALIDAS = { ok: false, motivo: 'credenciais_invalidas' }

describe('entrar', () => {
  test('senha certa: sessão criada e precisaTrocarSenha falso', async () => {
    const r = await entrar({ email: ' Ana@Teste.local ', senha: 'senha-da-ana', origem: '10.0.0.1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.precisaTrocarSenha).toBe(false)
    expect(r.expiraEm.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
    expect(await lerSessao(r.token)).toMatchObject({ nome: 'Ana' })
  })

  test('senha provisória pendente: entra e precisaTrocarSenha verdadeiro', async () => {
    const r = await entrar({ email: 'novo@teste.local', senha: 'provisoria-1', origem: null })
    expect(r).toMatchObject({ ok: true, precisaTrocarSenha: true })
  })

  test('senha errada, e-mail inexistente e usuário inativo respondem o mesmo', async () => {
    expect(await entrar({ email: 'ana@teste.local', senha: 'errada-123', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'ninguem@teste.local', senha: 'qualquer-1', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'saiu@teste.local', senha: 'senha-do-saiu', origem: null })).toEqual(INVALIDAS)
  })

  test('senha vazia ou longa demais: inválida sem tocar o banco (nenhuma tentativa registrada)', async () => {
    expect(await entrar({ email: 'ana@teste.local', senha: '', origem: null })).toEqual(INVALIDAS)
    expect(await entrar({ email: 'ana@teste.local', senha: 'x'.repeat(129), origem: null })).toEqual(INVALIDAS)
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'ana@teste.local' AND NOT sucesso",
    )
    expect(n).toBe(1)
  })

  test('tempo de e-mail inexistente e de senha errada na mesma ordem de grandeza (hash descartável roda)', async () => {
    const medir = async (email: string) => {
      const t = performance.now()
      await entrar({ email, senha: 'senha-errada-9', origem: null })
      return performance.now() - t
    }
    await medir('ana@teste.local')
    const errada = await medir('ana@teste.local')
    const inexistente = await medir('fantasma@teste.local')
    expect(inexistente).toBeGreaterThan(errada / 4)
    expect(inexistente).toBeLessThan(errada * 4)
  })

  test('décima falha bloqueia com segundos; bloqueado não roda scrypt nem registra', async () => {
    await criarUsuarioComSenha(banco, 'vendedor', 'Alvo', 'senha-do-alvo')
    let ultimo: Awaited<ReturnType<typeof entrar>> = INVALIDAS as never
    for (let i = 0; i < 10; i++) ultimo = await entrar({ email: 'alvo@teste.local', senha: 'errada-000', origem: '10.0.0.5' })
    expect(ultimo).toMatchObject({ ok: false, motivo: 'bloqueado' })
    if (ultimo.ok || ultimo.motivo !== 'bloqueado') return
    expect(ultimo.segundosRestantes).toBeGreaterThan(14 * 60)
    const t = performance.now()
    const certa = await entrar({ email: 'alvo@teste.local', senha: 'senha-do-alvo', origem: '10.0.0.5' })
    expect(performance.now() - t).toBeLessThan(150)
    expect(certa).toMatchObject({ ok: false, motivo: 'bloqueado' })
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'alvo@teste.local'",
    )
    expect(n).toBe(10)
  })
})
