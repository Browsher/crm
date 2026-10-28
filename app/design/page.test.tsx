import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

const exigir = vi.hoisted(() => vi.fn(async () => ({ usuarioId: 'gestor', nome: 'Ana Gestora', papel: 'gestor' })))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir }))
vi.mock('next/navigation', () => ({ usePathname: () => '/design' }))
vi.mock('./galeria', () => ({ Galeria: () => <div>Galeria visual</div> }))

test('protege a galeria para gestor antes de renderizar', async () => {
  const { default: PaginaDesign } = await import('./page')

  const html = renderToStaticMarkup(await PaginaDesign())
  expect(html).toContain('Galeria visual')
  expect(html).toContain('Navegação do CRM')
  expect(html).toContain('Ana Gestora')
  expect(html).toContain('Tema do design system')
  expect(exigir).toHaveBeenCalledWith('gestor')
})

test('pagina e galeria nao importam caminhos de escrita de negocio', () => {
  const fontes = [
    readFileSync(new URL('./page.tsx', import.meta.url), 'utf8'),
    readFileSync(new URL('./galeria.tsx', import.meta.url), 'utf8'),
  ].join('\n')

  expect(fontes).not.toMatch(/^import .*?(?:acoes|repositorio|registrar-visita-acao|server\/db)/m)
})


test('não renderiza o conteúdo quando a guarda recusa o acesso', async () => {
  exigir.mockRejectedValueOnce(new Error('acesso recusado'))
  const { default: PaginaDesign } = await import('./page')
  await expect(PaginaDesign()).rejects.toThrow('acesso recusado')
})
