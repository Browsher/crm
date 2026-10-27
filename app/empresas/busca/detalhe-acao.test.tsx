import { beforeEach, expect, test, vi } from 'vitest'
const m = vi.hoisted(() => ({ exigir: vi.fn(), repo: vi.fn(), ler: vi.fn(), limite: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: m.exigir }))
vi.mock('@/src/features/busca-empresas/repositorio', () => ({ repositorioBusca: m.repo }))
import { lerDetalheBuscaAcao } from './detalhe-acao'
import { isValidElement } from 'react'
import type { BuscaSalva } from '@/src/features/busca-empresas/tipos'

beforeEach(() => {
  vi.clearAllMocks()
  m.exigir.mockResolvedValue({ usuarioId: 'da-sessao', papel: 'vendedor' })
  m.repo.mockReturnValue({ ler: m.ler, meuLimite: m.limite })
  m.ler.mockResolvedValue({ id: 'busca', empresas: [] } as unknown as BuscaSalva)
  m.limite.mockResolvedValue({ pausado: true })
})
test('exige sessão válida antes de qualquer leitura', async () => {
  m.exigir.mockRejectedValue(new Error('sessão necessária'))
  await expect(lerDetalheBuscaAcao('busca')).rejects.toThrow('sessão necessária')
  expect(m.exigir).toHaveBeenCalledWith('usuario')
  expect(m.repo).not.toHaveBeenCalled()
})
test('usa identidade da sessão e leitura protegida por RLS, sem criar consulta', async () => {
  const r = await lerDetalheBuscaAcao('busca')
  expect(m.repo).toHaveBeenCalledWith('da-sessao')
  expect(m.ler).toHaveBeenCalledWith('busca')
  expect(r.ok).toBe(true)
  if (!r.ok || !isValidElement(r.conteudo)) throw new Error('conteúdo ausente')
  expect(r.conteudo.props).toMatchObject({ gestor: false, bloqueada: true })
})
test('ausência e falha não retornam dados de outra busca', async () => {
  m.ler.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('falha interna privada'))
  expect(await lerDetalheBuscaAcao('outra')).toMatchObject({ ok: false, erro: expect.stringContaining('não está disponível') })
  expect(await lerDetalheBuscaAcao('outra')).toEqual({ ok: false, erro: 'Não foi possível carregar a busca. Tente novamente.' })
  expect(m.limite).not.toHaveBeenCalled()
})
test('papel do gestor vem da sessão e dispensa limite de vendedor', async () => {
  m.exigir.mockResolvedValue({ usuarioId: 'gestor', papel: 'gestor' })
  const r = await lerDetalheBuscaAcao('busca')
  if (!r.ok || !isValidElement(r.conteudo)) throw new Error('conteúdo ausente')
  expect(r.conteudo.props).toMatchObject({ gestor: true, bloqueada: false })
  expect(m.limite).not.toHaveBeenCalled()
})
