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
  mocks.ler.mockResolvedValue({ id:'vendedor', nome:'Ana', email:'ana@teste.local', pagina:1, clientes:0,totalEmpresas:0,
    atrasados:0, hoje:0, contatosHoje:0, empresas:[], atividade:[] })
})
test('gestor vê estados vazios sem ações nem links para ficha de empresa', async () => {
  const html = renderToStaticMarkup(await Pagina({ params:Promise.resolve({ id:'vendedor' }) }))
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).toHaveBeenCalledWith('gestor','vendedor',1)
  expect(html).toContain('Ana')
  expect(html).toContain('Nenhuma empresa vinculada')
  expect(html).toContain('Nenhum atendimento registrado')
  expect(html).toContain('href="/usuarios"')
  expect(html).not.toContain('<form')
  expect(html).not.toContain('href="/empresas/')
})
test('alvo recusado vira 404', async () => {
  mocks.ler.mockResolvedValue(null)
  await expect(Pagina({ params:Promise.resolve({ id:'nada' }) })).rejects.toThrow('404')
})
test('51 vínculos sem vendas mantêm próxima página e rótulos de empresas, com KPI real de zero clientes', async () => {
  mocks.ler.mockResolvedValue({ id:'vendedor',nome:'Ana',email:'ana@teste.local',pagina:1,clientes:0,totalEmpresas:51,atrasados:1,hoje:2,contatosHoje:3,
    empresas:[{ id:'empresa',nome:'Aurora',cnpj:'11222333000181',proximoPasso:'Telefonar',retorno:'2026-09-15' }],
    atividade:[{ id:'c',empresaId:'empresa',empresa:'Aurora',tipo:'acompanhamento',nota:'Conversa registrada',proximoPasso:null,retorno:null,em:'2026-09-14T15:00:00Z' }] })
  const html = renderToStaticMarkup(await Pagina({ params:Promise.resolve({ id:'vendedor' }) }))
  expect(html).toContain('href="/usuarios/vendedores/vendedor?pagina=2"')
  expect(html).toContain('Empresas do vendedor')
  expect(html).toContain('aria-label="Empresas do vendedor"')
  expect(html).toContain('aria-label="Páginas das empresas"')
  expect(html).toContain('Página 1 de 2')
  expect(html).toContain('Clientes em carteira</h2><strong>0</strong>')
  expect(html).not.toContain('Carteira do vendedor')
  expect(html).toContain('15/09/2026')
  expect(html).toContain('Conversa registrada')
  expect(html).not.toContain('href="/empresas/')
})

test('cliente vendido na segunda página mantém anterior e KPI de uma venda',async()=>{
  mocks.ler.mockResolvedValue({id:'vendedor',nome:'Ana',email:'ana@teste.local',pagina:2,totalEmpresas:51,clientes:1,atrasados:0,hoje:0,contatosHoje:0,
    empresas:[{id:'cliente',nome:'Cliente após 50 prospects',cnpj:null,retorno:null,proximoPasso:null}],atividade:[]})
  const html=renderToStaticMarkup(await Pagina({params:Promise.resolve({id:'vendedor'}),searchParams:Promise.resolve({pagina:'2'})}))
  expect(mocks.ler).toHaveBeenCalledWith('gestor','vendedor',2)
  expect(html).toContain('Página 2 de 2')
  expect(html).toContain('href="/usuarios/vendedores/vendedor?pagina=1"')
  expect(html).toContain('Cliente após 50 prospects')
  expect(html).toContain('Clientes em carteira</h2><strong>1</strong>')
  expect(html).not.toContain('>Próxima</a>')
})

test('página vazia com vínculos e zero vendas oferece voltar à primeira página',async()=>{
  mocks.ler.mockResolvedValue({id:'vendedor',nome:'Ana',email:'ana@teste.local',pagina:3,totalEmpresas:51,clientes:0,atrasados:0,hoje:0,contatosHoje:0,empresas:[],atividade:[]})
  const html=renderToStaticMarkup(await Pagina({params:Promise.resolve({id:'vendedor'}),searchParams:Promise.resolve({pagina:'3'})}))
  expect(html).toContain('Nenhuma empresa nesta página')
  expect(html).toContain('Voltar para a primeira página')
  expect(html).toContain('href="/usuarios/vendedores/vendedor?pagina=1"')
  expect(html).not.toContain('Nenhuma empresa vinculada')
})
