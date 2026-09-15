import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Pagina from './page'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), perfil: vi.fn(), historico: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/empresas/perfil', () => ({ lerPerfilEmpresa: mocks.perfil }))
vi.mock('@/src/features/contato/historico', () => ({ lerHistorico: mocks.historico }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  mocks.perfil.mockResolvedValue({ id: 'id', razaoSocial: 'Aurora', cnpj: '11222333000181', telefone: '11987654321',
    situacao: 'disponivel', grupos: [], responsavel: null, proximoPasso: null, retorno: null })
  mocks.historico.mockResolvedValue({ ok: true, contatos: [] })
})
test('ficha de consulta sem ações de vendedor e volta preserva filtros', async () => {
  const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id: 'id' }), searchParams: Promise.resolve({ q: 'Aurora', uf: 'SP', pagina: '2' }) }))
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(html).toContain('Aurora')
  expect(html).toContain('href="/empresas?q=Aurora&amp;uf=SP&amp;pagina=2"')
  expect(html).toContain('Nenhum atendimento registrado')
  expect(html).not.toContain('<form')
  expect(html).not.toContain('Registrar atendimento')
})
test('inexistente não consulta histórico', async () => {
  mocks.perfil.mockResolvedValue(null)
  await expect(Pagina({ params: Promise.resolve({ id: 'nada' }) })).rejects.toThrow('404')
  expect(mocks.historico).not.toHaveBeenCalled()
})
test('falha no histórico não se apresenta como histórico vazio', async () => {
  mocks.historico.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })
  const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ id: 'id' }) }))
  expect(html).toContain('Não foi possível carregar o histórico')
  expect(html).not.toContain('Nenhum atendimento registrado')
})
