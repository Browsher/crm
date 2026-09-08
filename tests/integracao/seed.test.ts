import { afterAll, beforeAll, expect, test } from 'vitest'
import { entrar } from '@/src/server/autenticacao/entrar'
import { criarPrimeiroGestor } from '@/src/server/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

test('cria o primeiro gestor com credencial provisória; a senha devolvida entra e exige troca', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Alexandre', email: '  Alex@Exemplo.com ' })
  expect(r.ok).toBe(true)
  if (!r.ok) return
  expect(r.senhaProvisoria).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/)
  const [l] = await banco.sql<{ email: string; papel: string; criado_por: string | null; pendente: boolean }>(
    'SELECT email, papel, criado_por, senha_provisoria_pendente AS pendente FROM usuario',
  )
  expect(l).toEqual({ email: 'alex@exemplo.com', papel: 'gestor', criado_por: null, pendente: true })
  const cred = await banco.sql('SELECT 1 FROM autenticacao.credencial WHERE usuario_id = $1', [r.id])
  expect(cred).toHaveLength(1)
  const login = await entrar({ email: 'alex@exemplo.com', senha: r.senhaProvisoria, origem: null })
  expect(login).toMatchObject({ ok: true, precisaTrocarSenha: true })
})

test('recusa se já existe gestor ativo', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Outro', email: 'outro@exemplo.com' })
  expect(r).toEqual({ ok: false, motivo: 'ja_existe_gestor_ativo' })
})

test('recusa e-mail sem @', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'X', email: 'sem-arroba' })
  expect(r).toEqual({ ok: false, motivo: 'email_invalido' })
})
