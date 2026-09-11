import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ShellCrm } from './shell'

test('carteira ativa seu próprio menu e não expõe administração ao vendedor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="vendedor" area="carteira">Conteúdo</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/carteira"')
  expect(html).not.toContain('href="/usuarios"')
  expect(html).toContain('href="/meu-dia"')
  expect(html).toContain('Tema da Carteira')
  expect(html).toContain('Conteúdo')
})

test('fila mantém seu menu ativo e opções do gestor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="gestor" area="fila">Fila</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/fila"')
  expect(html).toContain('href="/usuarios"')
  expect(html).toContain('Tema da Fila')
})

test('meu dia ativa seu próprio menu e aparece para o vendedor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="vendedor" area="meu-dia">Agenda</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/meu-dia"')
  expect(html).toContain('href="/carteira"')
  expect(html).not.toContain('href="/usuarios"')
  expect(html).toContain('Tema do Meu dia')
  expect(html).toContain('Agenda')
})
