import { beforeEach, expect, test, vi } from 'vitest'
const iniciar = vi.hoisted(() => vi.fn())
const revalidar = vi.hoisted(() => vi.fn())
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('@/src/server/atendimento/operacoes', () => ({ iniciarAtendimento: iniciar }))
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
import { iniciarAtendimentoAcao } from './acoes'
beforeEach(() => { vi.clearAllMocks(); iniciar.mockResolvedValue({ ok: true, versao: 2, repetida: false }) })
test('inicia somente a empresa explícita com versão e chave recebidas', async () => {
  const form = new FormData()
  form.set('id', 'empresa'); form.set('chave', 'chave'); form.set('versao', '1'); form.set('vendedor', 'outro')
  expect(await iniciarAtendimentoAcao(form)).toEqual({ ok: true, versao: 2, repetida: false })
  expect(iniciar).toHaveBeenCalledWith('eu', { empresaId: 'empresa', chave: 'chave', versao: 1 })
  expect(revalidar).toHaveBeenCalledWith('/fila/localizar')
})
test('conflito é explícito e não informa sucesso', async () => {
  iniciar.mockResolvedValue({ ok: false, motivo: 'desatualizada' })
  expect(await iniciarAtendimentoAcao(new FormData())).toEqual({ ok: false, motivo: 'desatualizada' })
})
