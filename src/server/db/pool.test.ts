import { afterEach, expect, test } from 'vitest'
import { fecharPool, obterPool } from './pool'

const URL_A = 'postgres://x:y@localhost:1/a'
const URL_B = 'postgres://x:y@localhost:1/b'

afterEach(async () => {
  await fecharPool(URL_A)
  await fecharPool(URL_B)
})

test('mesma URL devolve a mesma instância, sobrevivendo a um novo import do módulo', async () => {
  const a = obterPool(URL_A)
  const b = obterPool(URL_A)
  expect(a).toBe(b)
  // Simula hot reload: módulo reavaliado, globalThis preservado.
  const { obterPool: obterDeNovo } = await import('./pool?reload=' + Date.now())
  expect(obterDeNovo(URL_A)).toBe(a)
})

test('URLs diferentes são pools diferentes', () => {
  expect(obterPool(URL_A)).not.toBe(obterPool(URL_B))
})
