import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import Pagina from './page'
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'gestor' }) }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: () => ({ semana: async () => [], vendedores: async () => [{ id: 'ana', nome: 'Ana' }] }) }))
test('gestor filtra pedidos por semana, vendedor e situação com ações explícitas', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ semana: '2026-10-19' }) }))
  expect(html).toContain('Planejamentos e coletas')
  expect(html).toContain('name="vendedor"')
  expect(html).toContain('name="estado"')
  expect(html).toContain('Aplicar filtros')
  expect(html).toContain('Ana')
  expect(html).toContain('Sem atendimento')
})
