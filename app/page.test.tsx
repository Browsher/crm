import { beforeEach, expect, test, vi } from 'vitest'

const { exigir } = vi.hoisted(() => ({ exigir: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))
import Inicio from './page'

beforeEach(() => { vi.resetAllMocks() })

test('entrada autenticada encaminha para Meu dia', async () => {
  exigir.mockResolvedValue({ nome: 'Ana', papel: 'vendedor' })
  await expect(Inicio()).rejects.toMatchObject({ digest: 'NEXT_REDIRECT;replace;/meu-dia;307;' })
  expect(exigir).toHaveBeenCalledWith('usuario')
})

test('entrada respeita a interrupção da guarda antes de encaminhar', async () => {
  const bloqueio = new Error('troca de senha obrigatória')
  exigir.mockRejectedValue(bloqueio)
  await expect(Inicio()).rejects.toBe(bloqueio)
})
