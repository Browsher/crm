import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ recentes: vi.fn(), sugestoes: vi.fn(), consultar: vi.fn(), minhas: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('@/src/features/prospeccao/recentes', () => ({ listarRecentes: mocks.recentes, listarSugestoes: mocks.sugestoes }))
vi.mock('@/src/features/prospeccao/repositorio', () => ({ listarOpcoes: async () => ({ ok: true, opcoes: [] }), consultarEmpresas: mocks.consultar }))
vi.mock('@/src/features/fila/consulta', () => ({ lerMinhasEmpresas: mocks.minhas }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('../acoes', () => ({ agirNaFilaAcao: vi.fn() }))
import Pagina from './page'

const empresa = { id: '00000000-0000-4000-8000-000000000001', razaoSocial: 'Empresa recente', nomeFantasia: null, cnaePrincipal: null, cidade: null, uf: null, bairro: null, disponibilidade: 'outro_vendedor' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.recentes.mockResolvedValue({ ok: true, empresas: [empresa] })
  mocks.sugestoes.mockResolvedValue({ ok: true, empresas: [{ ...empresa, razaoSocial: 'Empresa sugerida' }] })
  mocks.consultar.mockResolvedValue({ ok: true, empresas: [{ ...empresa, razaoSocial: 'Empresa filtrada' }], temProxima: false })
  mocks.minhas.mockResolvedValue({ ok: true, contexto: null, reserva: null })
})
test('sem filtros mostra recentes com link para o perfil', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('Empresas recentes')
  expect(html).toContain('Ver perfil')
  expect(html).toContain(`/fila/localizar/${empresa.id}`)
  expect(html).not.toContain('Empresa sugerida')
})
test('sem recentes mostra sugestões', async () => {
  mocks.recentes.mockResolvedValue({ ok: true, empresas: [] })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).toContain('Sugestões de empresas')
  expect(html).toContain('Empresa sugerida')
})
test('busca filtrada não mistura recentes e preserva filtros no perfil', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ nome: 'Luz', pagina: '2' }) }))
  expect(html).toContain('Empresa filtrada')
  expect(html).not.toContain('Empresa recente')
  expect(html).toContain(`/fila/localizar/${empresa.id}?nome=Luz&amp;pagina=2`)
})

test('reserva atual oferece retorno para a fila com os filtros preservados', async () => {
  mocks.minhas.mockResolvedValue({ ok: true, contexto: null, reserva: { id: empresa.id } })
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({ nome: 'Luz & Cia', uf: 'SP', pagina: '2' }) }))
  expect(html).toContain('Voltar para a fila')
  expect(html).toContain('/fila?nome=Luz+%26+Cia&amp;uf=SP&amp;pagina=2')
})

test('sem reserva atual não oferece avanço para a fila', async () => {
  const html = renderToStaticMarkup(await Pagina({ searchParams: Promise.resolve({}) }))
  expect(html).not.toContain('Voltar para a fila')
})
