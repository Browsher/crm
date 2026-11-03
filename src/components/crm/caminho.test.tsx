import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { CaminhoCrm } from './caminho'

const rota = vi.hoisted(() => ({ atual: '/whatsapp', query: new URLSearchParams() }))
vi.mock('next/navigation', () => ({ usePathname: () => rota.atual, useSearchParams: () => rota.query }))

test.each([
  ['/whatsapp/configuracao', 'whatsapp', 'WhatsApp', 'Configurar vendedores', '/whatsapp'],
  ['/empresas/importar', 'empresas', 'Empresas', 'Importar empresas', '/empresas'],
  ['/empresas/grupos', 'empresas', 'Empresas', 'Listas', '/empresas'],
  ['/empresas/grupos/id-privado', 'empresas', 'Empresas', 'Detalhes da lista', '/empresas/grupos'],
  ['/empresas/id-privado', 'empresas', 'Empresas', 'Ficha da empresa', '/empresas'],
  ['/empresas/arquivadas', 'empresas', 'Empresas', 'Arquivo', '/empresas'],
  ['/usuarios/vendedores/id-privado', 'usuarios', 'Usuários', 'Perfil do vendedor', '/usuarios'],
  ['/carteira/id-privado', 'carteira', 'Carteira', 'Ficha da empresa', '/carteira'],
  ['/fila/localizar', 'fila', 'Prospecção', 'Localizar empresas', '/fila'],
  ['/fila/localizar/id-privado', 'fila', 'Prospecção', 'Perfil da empresa', '/fila/localizar'],
])('mapeia %s com retorno ao nível existente', (url, area, titulo, atual, retorno) => {
  rota.atual = url
  const html = renderToStaticMarkup(<CaminhoCrm area={area} titulo={titulo} />)
  expect(html).toContain(`href="${retorno}"`)
  expect(html).toContain(`aria-current="page">${atual}</span>`)
  expect(html).not.toContain('id-privado')
  expect(html).not.toContain('href="/usuarios/vendedores"')
})

test('breadcrumb da lista arquivada volta ao recorte do arquivo', () => {
  rota.atual = '/empresas/grupos/11111111-1111-4111-8111-111111111111'
  rota.query = new URLSearchParams({ retorno: '{"tipo":"arquivo","q":"Luz","pagina":2,"gruposPagina":3}' })
  try {
    const html = renderToStaticMarkup(<CaminhoCrm area="empresas" titulo="Empresas" />)
    expect(html).toContain('href="/empresas/arquivadas?q=Luz&amp;pagina=2&amp;gruposPagina=3">Arquivo</a>')
    expect(html).not.toContain('href="/empresas/grupos"')
    expect(html).not.toContain('href="/empresas"')
    expect(html).toContain('aria-current="page">Lista arquivada</span>')
  } finally {
    rota.query = new URLSearchParams()
  }
})
