import { expect, test, vi } from 'vitest'
import { lerTelefoneNegociacao } from './consulta'
let linhas: { telefone: string | null }[] = []
vi.mock('@/src/server/db/como-usuario', () => ({ comoUsuario: async (_id: string, trabalho: (e: unknown) => unknown) => trabalho(async () => ({ linhas })) }))
test('empresa acessível sem telefone permite atendimento, empresa inacessível retorna null', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  linhas = [{ telefone: null }]
  expect(await lerTelefoneNegociacao(id, id)).toBe('')
  linhas = []
  expect(await lerTelefoneNegociacao(id, id)).toBeNull()
})
