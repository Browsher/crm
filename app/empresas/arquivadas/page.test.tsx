import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import Pagina from './page'
const deps = vi.hoisted(() => ({ listar: vi.fn(), grupos: vi.fn(), exigir: vi.fn() }))
vi.mock('@/src/features/empresas/listagem', () => ({ listarEmpresas: deps.listar }))
vi.mock('@/src/features/empresas/grupos', async original => ({ ...await original<object>(), listarGrupos: deps.grupos }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('../lista', () => ({ Lista: () => <p>Cards do arquivo</p> }))
beforeEach(() => {
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.listar.mockResolvedValue({ ok: true, linhas: [{}], total: 101 })
  deps.grupos.mockResolvedValue({ ok: true, grupos: [{ id: '11111111-1111-4111-8111-111111111111', nome: 'Lista arquivada sintética', total: 1 }], resumo: { total: 1, ativos: 0, desativados: 1, empresas: 1 } })
})
test('arquivo exige gestor e pagina dentro do arquivo preservando busca', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ q: 'Loja', pagina: '2' }) }))
  expect(deps.exigir).toHaveBeenCalledWith('gestor')
  expect(deps.listar).toHaveBeenCalledWith('gestor', expect.objectContaining({ termo: 'Loja', pagina: 2 }), true)
  expect(deps.grupos).toHaveBeenCalledWith('gestor', 1, true)
  expect(html).toContain('Histórico preservado, somente consulta.')
  expect(html).toContain('Cards do arquivo')
  expect(html).toContain('/empresas/arquivadas?q=Loja&amp;pagina=3')
  expect(html).toContain('/empresas/grupos/11111111-1111-4111-8111-111111111111?retorno=')
  expect(html).toContain('data-slot="card"')
  expect(html).toContain('>1 empresa</div>')
  expect(html).not.toContain('>1 empresas</div>')
  expect(html).toContain('Ver lista')
  expect(html).toContain('aria-labelledby="listas-arquivadas"')
})

test('a segunda página de listas é independente da página de empresas', async () => {
  deps.grupos.mockResolvedValue({
    ok: true,
    grupos: [{ id: '11111111-1111-4111-8111-111111111111', nome: 'Lista 51', total: 1 }],
    resumo: { total: 51, ativos: 0, desativados: 51, empresas: 1 },
  })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ q: 'Loja', pagina: '3', gruposPagina: '2' }) }))
  expect(deps.grupos).toHaveBeenCalledWith('gestor', 2, true)
  expect(html).toContain('aria-label="Paginação de listas arquivadas"')
  expect(html).toContain('name="gruposPagina" value="2"')
  expect(html).toContain('/empresas/arquivadas?q=Loja&amp;pagina=2&amp;gruposPagina=2')
  expect(html).toContain('/empresas/arquivadas?q=Loja&amp;pagina=3"')
})

test('página de empresas sem linhas volta à primeira página mantendo a busca', async () => {
  deps.listar.mockResolvedValue({ ok: true, linhas: [], total: 0 })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ q: 'Loja', pagina: '5', gruposPagina: '2' }) }))
  expect(html).not.toContain('0 empresas arquivadas')
  expect(html).not.toContain('Página 5 de 1')
  expect(html).toContain('href="/empresas/arquivadas?q=Loja&amp;gruposPagina=2">Voltar à primeira página')
})
