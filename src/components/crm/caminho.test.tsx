import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { CaminhoCrm } from './caminho'

const grupoId = '11111111-1111-4111-8111-111111111111'
const arquivo = '{"tipo":"arquivo","q":"Luz","pagina":2,"gruposPagina":3}'
const grupo = '{"tipo":"grupo","id":"' + grupoId + '","pagina":2,"gruposPagina":1,"arquivo":' + arquivo + '}'
const hrefArquivo = '/empresas/arquivadas?q=Luz&amp;pagina=2&amp;gruposPagina=3'

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
  rota.atual = '/empresas/grupos/' + grupoId
  rota.query = new URLSearchParams({ retorno: arquivo })
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

test.each([
  ['arquivo', [arquivo], false],
  ['lista arquivada', [grupo], true],
] as const)('breadcrumb da ficha aberta de %s mantém a origem', (_origem, retornos, temGrupo) => {
  rota.atual = '/empresas/22222222-2222-4222-8222-222222222222'
  rota.query = new URLSearchParams(retornos.map(retorno => ['retorno', retorno]))
  try {
    const html = renderToStaticMarkup(<CaminhoCrm area="empresas" titulo="Empresas" />)
    expect(html).toContain(`href="${hrefArquivo}">Arquivo</a>`)
    expect(html).not.toContain('href="/empresas"')
    expect(html).not.toContain('href="/empresas/grupos"')
    expect(html).toContain('aria-current="page">Ficha da empresa</span>')
    if (temGrupo) {
      const lista = '/empresas/grupos/' + grupoId + '?pagina=2&amp;' + new URLSearchParams({ retorno: arquivo })
      expect(html).toContain(`href="${lista}">Lista arquivada</a>`)
    } else {
      expect(html).not.toContain('Lista arquivada')
    }
  } finally {
    rota.query = new URLSearchParams()
  }
})

test.each([['retorno duplicado', [arquivo, arquivo]], ['retorno inválido', ['https://externo.test']]] as const)(
  'breadcrumb da ficha conserva Empresas com %s',
  (_origem, retornos) => {
    rota.atual = '/empresas/22222222-2222-4222-8222-222222222222'
    rota.query = new URLSearchParams(retornos.map(retorno => ['retorno', retorno]))
    try {
      const html = renderToStaticMarkup(<CaminhoCrm area="empresas" titulo="Empresas" />)
      expect(html).toContain('href="/empresas">Empresas</a>')
      expect(html).not.toContain('Arquivo</a>')
    } finally {
      rota.query = new URLSearchParams()
    }
  },
)

test.each([
  ['/fila/sem-interesse', '', 'Sem interesse', undefined],
  ['/fila/localizar', 'disponibilidade=sem_interesse', 'Sem interesse', '/fila/localizar'],
  ['/fila/atendimento/id-privado', 'disponibilidade=sem_interesse&pagina=2', 'Atendimento', '/fila/localizar?disponibilidade=sem_interesse&amp;pagina=2&amp;pesquisado=1'],
] as const)('mostra a trilha da consulta e do atendimento em %s', (atual, query, rotulo, retorno) => {
  rota.atual = atual
  rota.query = new URLSearchParams(query)
  try {
    const html = renderToStaticMarkup(<CaminhoCrm area="fila" titulo="Prospecção" />)
    expect(html).toContain(`aria-current="page">${rotulo}</span>`)
    if (retorno) expect(html).toContain(`href="${retorno}"`)
  } finally { rota.query = new URLSearchParams() }
})
