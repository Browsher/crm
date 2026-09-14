import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import PaginaEmpresas from './page'
import LayoutEmpresas from './layout'
import { exigir } from '@/src/server/autenticacao/guarda'
import { listarEmpresas } from '@/src/features/empresas/listagem'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
vi.mock('@/src/features/empresas/listagem', () => ({ listarEmpresas: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(exigir).mockResolvedValue({ usuarioId: 'gestor', nome: 'Ana', papel: 'gestor' } as Awaited<ReturnType<typeof exigir>>)
  vi.mocked(listarEmpresas).mockResolvedValue({ ok: true, linhas: [], total: 0 })
})

test('busca tem nome acessível, conserva termo e reinicia paginação', async () => {
  const html = renderToStaticMarkup(await PaginaEmpresas({ searchParams: Promise.resolve({ q: 'luz', pagina: '2' }) }))
  expect(html).toContain('for="empresas-busca"')
  expect(html).toContain('id="empresas-busca"')
  expect(html).toContain('value="luz"')
  expect(html).toContain('method="get"')
  expect(html).not.toContain('name="pagina"')
  expect(html).toContain('Importar empresas')
  expect(exigir).toHaveBeenCalledWith('gestor')
})

test('layout exige gestor antes de renderizar o shell', async () => {
  const html = renderToStaticMarkup(await LayoutEmpresas({ children: 'Tabela' }))
  expect(exigir).toHaveBeenCalledWith('gestor')
  expect(html).toContain('Tema de Empresas')
})

test('layout não renderiza conteúdo se guarda recusa acesso', async () => {
  vi.mocked(exigir).mockRejectedValue(new Error('acesso recusado'))
  await expect(LayoutEmpresas({ children: 'Tabela' })).rejects.toThrow('acesso recusado')
})
