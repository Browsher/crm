import { beforeEach, expect, test, vi } from 'vitest'
import Pagina from './page'
import { exigir } from '@/src/server/autenticacao/guarda'
import { redirect } from 'next/navigation'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirecionamento') }) }))

beforeEach(() => vi.clearAllMocks())

test('endereço antigo exige gestor antes de encaminhar para Empresas', async () => {
  await expect(Pagina()).rejects.toThrow('redirecionamento')
  expect(exigir).toHaveBeenCalledWith('gestor')
  expect(redirect).toHaveBeenCalledWith('/empresas')
  expect(vi.mocked(exigir).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(redirect).mock.invocationCallOrder[0])
})

test('guarda recusada conserva o tratamento de visitantes e vendedores', async () => {
  vi.mocked(exigir).mockRejectedValueOnce(new Error('acesso recusado'))
  await expect(Pagina()).rejects.toThrow('acesso recusado')
  expect(redirect).not.toHaveBeenCalled()
})
