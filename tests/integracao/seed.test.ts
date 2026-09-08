import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarPrimeiroGestor } from '@/src/server/db/seed'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
beforeAll(async () => {
  banco = await criarBancoDeTeste()
})
afterAll(async () => {
  await banco.derrubar()
})

test('cria o primeiro gestor com criado_por nulo e e-mail normalizado', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Alexandre', email: '  Alex@Exemplo.com ' })
  expect(r.ok).toBe(true)
  const [l] = await banco.sql<{ email: string; papel: string; criado_por: string | null }>(
    'SELECT email, papel, criado_por FROM usuario',
  )
  expect(l).toEqual({ email: 'alex@exemplo.com', papel: 'gestor', criado_por: null })
})

test('recusa se já existe gestor ativo', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'Outro', email: 'outro@exemplo.com' })
  expect(r).toEqual({ ok: false, motivo: 'ja_existe_gestor_ativo' })
})

test('recusa e-mail sem @', async () => {
  const r = await criarPrimeiroGestor(banco.urlAdmin, { nome: 'X', email: 'sem-arroba' })
  expect(r).toEqual({ ok: false, motivo: 'email_invalido' })
})
