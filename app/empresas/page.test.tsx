import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import PaginaEmpresas from './page'
import LayoutEmpresas from './layout'
import { exigir } from '@/src/server/autenticacao/guarda'
import { listarEmpresas, listarOpcoesEmpresas } from '@/src/features/empresas/listagem'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
vi.mock('@/src/features/empresas/listagem', () => ({ listarEmpresas: vi.fn(), listarOpcoesEmpresas: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), useRouter: () => ({ push: vi.fn() }) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(exigir).mockResolvedValue({ usuarioId: 'gestor', nome: 'Ana', papel: 'gestor' } as Awaited<ReturnType<typeof exigir>>)
  vi.mocked(listarEmpresas).mockResolvedValue({ ok: true, linhas: [], total: 0 })
  vi.mocked(listarOpcoesEmpresas).mockResolvedValue({ ok: true, opcoes: [] })
})

test('busca tem nome acessível, conserva termo e reinicia paginação', async () => {
  const html = renderToStaticMarkup(await PaginaEmpresas({ searchParams: Promise.resolve({ q: 'luz', pagina: '2' }) }))
  expect(html).toContain('for="empresas-busca"')
  expect(html).toContain('id="empresas-busca"')
  expect(html).toContain('value="luz"')
  expect(html).toContain('method="get"')
  expect(html).not.toContain('name="pagina"')
  expect(html).toContain('Importar empresas')
  expect(html).toContain('>CNAE<')
  expect(html).toContain('>Estado<')
  expect(html).toContain('>Cidade<')
  expect(html).toContain('>Bairro<')
  expect(html).toContain('Limpar filtros')
  expect(exigir).toHaveBeenCalledWith('gestor')
})

test('filtro inválido exibe aviso sem consultar banco', async () => {
  const html = renderToStaticMarkup(await PaginaEmpresas({ searchParams: Promise.resolve({ cidade: '3550308' }) }))
  expect(html).toContain('Não foi possível aplicar os filtros')
  expect(listarEmpresas).not.toHaveBeenCalled()
  expect(listarOpcoesEmpresas).not.toHaveBeenCalled()
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
