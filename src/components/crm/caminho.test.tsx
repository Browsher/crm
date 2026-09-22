import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { CaminhoCrm } from './caminho'

const rota = vi.hoisted(() => ({ atual: '/whatsapp' }))
vi.mock('next/navigation', () => ({ usePathname: () => rota.atual }))

test.each([
  ['/whatsapp/configuracao', 'whatsapp', 'WhatsApp', 'Configurar vendedores', '/whatsapp'],
  ['/empresas/importar', 'empresas', 'Empresas', 'Importar empresas', '/empresas'],
  ['/empresas/grupos', 'empresas', 'Empresas', 'Grupos', '/empresas'],
  ['/empresas/grupos/id-privado', 'empresas', 'Empresas', 'Detalhes do grupo', '/empresas/grupos'],
  ['/empresas/id-privado', 'empresas', 'Empresas', 'Ficha da empresa', '/empresas'],
  ['/usuarios/vendedores/id-privado', 'usuarios', 'Usuários', 'Perfil do vendedor', '/usuarios'],
  ['/carteira/id-privado', 'carteira', 'Carteira', 'Ficha da empresa', '/carteira'],
  ['/fila/localizar', 'fila', 'Prospecção', 'Localizar empresa', '/fila'],
  ['/fila/localizar/id-privado', 'fila', 'Prospecção', 'Perfil da empresa', '/fila/localizar'],
])('mapeia %s com retorno ao nível existente', (url, area, titulo, atual, retorno) => {
  rota.atual = url
  const html = renderToStaticMarkup(<CaminhoCrm area={area} titulo={titulo} />)
  expect(html).toContain(`href="${retorno}"`)
  expect(html).toContain(`aria-current="page">${atual}</span>`)
  expect(html).not.toContain('id-privado')
  expect(html).not.toContain('href="/usuarios/vendedores"')
})
