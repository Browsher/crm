import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { ShellCrm } from './shell'

test('usuários ativa seu menu e oferece tema próprio ao gestor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="gestor" area="usuarios">Lista</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/usuarios"')
  expect(html).toContain('Tema de Usuários')
})

test('empresas ativa seu menu e oferece tema próprio ao gestor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="gestor" area="empresas">Tabela</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/empresas"')
  expect(html).toContain('Tema de Empresas')
})

test('carteira ativa seu próprio menu e não expõe administração ao vendedor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="vendedor" area="carteira">Conteúdo</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/carteira"')
  expect(html).not.toContain('href="/usuarios"')
  expect(html).toContain('href="/meu-dia"')
  expect(html).toContain('Tema da Carteira')
  expect(html).toContain('Conteúdo')
})

test('gestor tem início e administração sem links de atendimento', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="gestor" area="gestao">Gestão</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/gestao"')
  expect(html).toContain('href="/usuarios"')
  expect(html).toContain('href="/empresas/grupos"')
  for (const rota of ['/fila', '/carteira', '/meu-dia']) expect(html).not.toContain(`href="${rota}"`)
})

test('meu dia ativa seu próprio menu e aparece para o vendedor', () => {
  const html = renderToStaticMarkup(<ShellCrm nome="Ana" papel="vendedor" area="meu-dia">Agenda</ShellCrm>)
  expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/meu-dia"')
  expect(html).toContain('href="/carteira"')
  expect(html).not.toContain('href="/usuarios"')
  expect(html).toContain('Tema do Meu dia')
  expect(html).toContain('Agenda')
  expect(html).not.toContain('>Início</a>')
  expect(html).toContain('action="/sair"')
  expect(html).toContain('method="post"')
  expect(html).toContain('>Sair</button>')
})
