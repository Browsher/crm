import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ShellFila } from './shell'

test('menu do vendedor não oferece administração e mantém conteúdo', () => {
  const html = renderToStaticMarkup(<ShellFila papel="vendedor" nome="Ana"><main>Minha fila</main></ShellFila>)
  expect(html).toContain('Minha fila')
  expect(html).toContain('data-theme="system"')
  expect(html).not.toContain('href="/usuarios"')
  expect(html).not.toContain('href="/empresas"')
})

test('gestor tem links administrativos reais', () => {
  const html = renderToStaticMarkup(<ShellFila papel="gestor" nome="Ana"><main>Fila</main></ShellFila>)
  expect(html).toContain('href="/usuarios"')
  expect(html).toContain('href="/empresas"')
})
