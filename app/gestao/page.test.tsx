import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Gestao from './page'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn(), atividade: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/gestao/consulta', () => ({ lerDashboard: mocks.ler }))
vi.mock('@/src/features/gestao/atividade', () => ({ lerAtividadeGestao: mocks.atividade }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  mocks.ler.mockResolvedValue({ vendedores: [], disponiveis: 0 })
  mocks.atividade.mockResolvedValue({ eventos: [], total: 0 })
})
test('autoriza gestor, exibe vazio sem atalhos inferiores nem busca de vendedores', async () => {
  const html = renderToStaticMarkup(await Gestao())
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).toHaveBeenCalledWith('gestor')
  expect(html).toContain('Nenhum vendedor ativo')
  expect(html).toContain('Atividade recente')
  expect(html).toContain('Ver atividade completa')
  for (const rota of ['/empresas', '/empresas/grupos', '/usuarios']) expect(html).not.toContain(`href="${rota}"`)
  expect(html).not.toContain('<input')
})
test('tabela da equipe dá acesso ao perfil e os destaques usam entregas confirmadas', async () => {
  mocks.ler.mockResolvedValue({ vendedores: [
    { id: 'a', nome: 'Ana', clientes: 9, atrasados: 2, hoje: 3, contatosHoje: 7 },
    { id: 'b', nome: 'Bia', clientes: 2, atrasados: 1, hoje: 2, contatosHoje: 4 },
  ], disponiveis: 12 })
  mocks.atividade.mockImplementation(async (_id, _filtros, modo) => modo === 'destaques' ? { total: 1, eventos: [{
    id: 'busca', categoria: 'banco', vendedorId: 'a', vendedor: 'Ana', em: '2026-11-13T14:00:00Z', subtipo: 'concluida',
    empresaId: null, empresa: null, dados: { entregues: 2, retornadas: 10 },
  }] } : { total: 0, eventos: [] })
  const html = renderToStaticMarkup(await Gestao())
  expect(html).toContain('Retornos hoje')
  expect(html).toContain('Contatos registrados hoje')
  expect(html).toContain('Ana')
  expect(html).toContain('<table')
  expect(html).toContain('aria-label="Vendedores ativos"')
  expect(html).toContain('href="/usuarios/vendedores/a?origem=gestao"')
  expect(html).toContain('Ana recebeu 2 empresas do Banco')
  const resumo = html.split('</section>')[0]
  expect(resumo).toMatch(/Retornos atrasados<\/h2><strong[^>]*>3<\/strong>/)
  expect(resumo).toMatch(/Retornos hoje<\/h2><strong[^>]*>5<\/strong>/)
  expect(resumo).toMatch(/Clientes em carteira<\/h2><strong[^>]*>11<\/strong>/)
})
test('recusa no banco não é apresentada como dashboard zerado', async () => {
  mocks.ler.mockResolvedValue(null)
  const html = renderToStaticMarkup(await Gestao())
  expect(html).toContain('Sem permissão')
  expect(html).not.toContain('Nenhum vendedor ativo')
})
test('falha de infraestrutura sobe para o tratamento de erro', async () => {
  mocks.ler.mockRejectedValueOnce(new Error('indisponível'))
  await expect(Gestao()).rejects.toThrow('indisponível')
})
