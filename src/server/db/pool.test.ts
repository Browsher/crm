import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { attachDatabasePool } from '@vercel/functions'
import { fecharPool, obterPool } from './pool'

vi.mock('@vercel/functions', () => ({ attachDatabasePool: vi.fn() }))

const URL_A = 'postgres://x:y@localhost:1/a'
const URL_B = 'postgres://x:y@localhost:1/b'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('PG_POOL_MAX', '')
})

afterEach(async () => {
  await fecharPool(URL_A)
  await fecharPool(URL_B)
  vi.unstubAllEnvs()
})

test('mesma URL devolve a mesma instância, sobrevivendo a um novo import do módulo', async () => {
  const a = obterPool(URL_A)
  const b = obterPool(URL_A)
  expect(a).toBe(b)
  const { obterPool: obterDeNovo } = await import('./pool?reload=' + Date.now())
  expect(obterDeNovo(URL_A)).toBe(a)
})

test('URLs diferentes são pools diferentes', () => {
  expect(obterPool(URL_A)).not.toBe(obterPool(URL_B))
})

test('respeita limite de produção e registra cada pool uma vez na Vercel', () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('PG_POOL_MAX', '2')
  const pool = obterPool(URL_A)
  expect(pool.options.max).toBe(2)
  expect(obterPool(URL_A)).toBe(pool)
  expect(attachDatabasePool).toHaveBeenCalledExactlyOnceWith(pool)
})

test('mantém o padrão fora da Vercel sem registrar hook de suspensão', () => {
  const pool = obterPool(URL_A)
  expect(pool.options.max).toBe(10)
  expect(attachDatabasePool).not.toHaveBeenCalled()
})

test('URLs distintas recebem registro próprio na Vercel', () => {
  vi.stubEnv('VERCEL', '1')
  const a = obterPool(URL_A)
  const b = obterPool(URL_B)
  expect(a).not.toBe(b)
  expect(attachDatabasePool).toHaveBeenCalledTimes(2)
  expect(attachDatabasePool).toHaveBeenCalledWith(a)
  expect(attachDatabasePool).toHaveBeenCalledWith(b)
})

test('fechar e reabrir uma URL registra o novo pool sem reutilizar o encerrado', async () => {
  vi.stubEnv('VERCEL', '1')
  const anterior = obterPool(URL_A)
  await fecharPool(URL_A)
  const novo = obterPool(URL_A)
  expect(novo).not.toBe(anterior)
  expect(attachDatabasePool).toHaveBeenCalledTimes(2)
  expect(attachDatabasePool).toHaveBeenLastCalledWith(novo)
})