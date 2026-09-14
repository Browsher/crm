import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Gestao from './page'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/gestao/consulta', () => ({ lerDashboard: mocks.ler }))
beforeEach(() => {
  mocks.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  mocks.ler.mockResolvedValue({ vendedores: [], disponiveis: 0, atividade: [] })
})
test('autoriza gestor, exibe vazio e preserva atalhos sem busca de vendedores', async () => {
  const html = renderToStaticMarkup(await Gestao())
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).toHaveBeenCalledWith('gestor')
  expect(html).toContain('Nenhum vendedor ativo')
  expect(html).toContain('Nenhum contato registrado')
  for (const rota of ['/empresas', '/empresas/grupos', '/usuarios']) expect(html).toContain(`href="${rota}"`)
  expect(html).not.toContain('<input')
})
test('cards usam rótulos distintos, totais e atividade sem inferir venda ou devolução', async () => {
  mocks.ler.mockResolvedValue({ vendedores: [
    { id: 'a', nome: 'Ana', clientes: 9, atrasados: 2, hoje: 3, contatosHoje: 7 },
    { id: 'b', nome: 'Bia', clientes: 2, atrasados: 1, hoje: 2, contatosHoje: 4 },
  ], disponiveis: 12, atividade: [{ id: 'c', vendedor: 'Ana', empresa: 'Loja', tipo: 'interessado', em: '2026-09-14T15:00:00Z' }] })
  const html = renderToStaticMarkup(await Gestao())
  expect(html).toContain('Retornos hoje')
  expect(html).toContain('Contatos registrados hoje')
  expect(html).toContain('Ana')
  expect(html).toContain('Loja')
  expect(html).toContain('interessado')
  expect(html).not.toContain('Ver detalhes')
  expect(html).not.toContain('devolveu')
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
