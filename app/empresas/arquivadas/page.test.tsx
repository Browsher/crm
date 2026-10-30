import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import Pagina from './page'
const deps = vi.hoisted(() => ({ listar: vi.fn(), grupos: vi.fn(), exigir: vi.fn() }))
vi.mock('@/src/features/empresas/listagem', () => ({ listarEmpresas: deps.listar }))
vi.mock('@/src/features/empresas/grupos', () => ({ listarGrupos: deps.grupos }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('../lista', () => ({ Lista: () => <p>Cards do arquivo</p> }))
beforeEach(() => {
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.listar.mockResolvedValue({ ok: true, linhas: [], total: 101 })
  deps.grupos.mockResolvedValue({ ok: true, grupos: [{ id: 'lista-sintetica', nome: 'Lista arquivada sintética', total: 1 }] })
})
test('arquivo exige gestor e pagina dentro do arquivo preservando busca', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ q: 'Loja', pagina: '2' }) }))
  expect(deps.exigir).toHaveBeenCalledWith('gestor')
  expect(deps.listar).toHaveBeenCalledWith('gestor', expect.objectContaining({ termo: 'Loja', pagina: 2 }), true)
  expect(deps.grupos).toHaveBeenCalledWith('gestor', 1, true)
  expect(html).toContain('Histórico preservado, somente consulta.')
  expect(html).toContain('Cards do arquivo')
  expect(html).toContain('/empresas/arquivadas?q=Loja&amp;pagina=3')
  expect(html).toContain('/empresas/grupos/lista-sintetica')
  expect(html).toContain('data-slot="card"')
  expect(html).toContain('>1 empresa</div>')
  expect(html).not.toContain('>1 empresas</div>')
  expect(html).toContain('Ver lista')
  expect(html).toContain('aria-labelledby="listas-arquivadas"')
})
