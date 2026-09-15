import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Pagina from './page'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/gestao/perfil-vendedor', async importOriginal => ({
  ...await importOriginal<typeof import('@/src/features/gestao/perfil-vendedor')>(), lerPerfilVendedor: mocks.ler,
}))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('404') } }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exigir.mockResolvedValue({ usuarioId:'gestor' })
  mocks.ler.mockResolvedValue({ id:'vendedor', nome:'Ana', email:'ana@teste.local', pagina:1, clientes:0,
    atrasados:0, hoje:0, contatosHoje:0, empresas:[], atividade:[] })
})
test('gestor vê estados vazios sem ações nem links para ficha de empresa', async () => {
  const html = renderToStaticMarkup(await Pagina({ params:Promise.resolve({ id:'vendedor' }) }))
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).toHaveBeenCalledWith('gestor','vendedor',1)
  expect(html).toContain('Ana')
  expect(html).toContain('Nenhuma empresa na carteira')
  expect(html).toContain('Nenhum atendimento registrado')
  expect(html).toContain('href="/usuarios"')
  expect(html).not.toContain('<form')
  expect(html).not.toContain('href="/empresas/')
})
test('alvo recusado vira 404', async () => {
  mocks.ler.mockResolvedValue(null)
  await expect(Pagina({ params:Promise.resolve({ id:'nada' }) })).rejects.toThrow('404')
})
test('paginação preserva alvo e não inventa atividade ao consultar carteira', async () => {
  mocks.ler.mockResolvedValue({ id:'vendedor',nome:'Ana',email:'ana@teste.local',pagina:1,clientes:51,atrasados:1,hoje:2,contatosHoje:3,
    empresas:[{ id:'empresa',nome:'Aurora',cnpj:'11222333000181',proximoPasso:'Telefonar',retorno:'2026-09-15' }],
    atividade:[{ id:'c',empresaId:'empresa',empresa:'Aurora',tipo:'acompanhamento',nota:'Conversa registrada',proximoPasso:null,retorno:null,em:'2026-09-14T15:00:00Z' }] })
  const html = renderToStaticMarkup(await Pagina({ params:Promise.resolve({ id:'vendedor' }) }))
  expect(html).toContain('href="/usuarios/vendedores/vendedor?pagina=2"')
  expect(html).toContain('15/09/2026')
  expect(html).toContain('Conversa registrada')
  expect(html).not.toContain('href="/empresas/')
})
