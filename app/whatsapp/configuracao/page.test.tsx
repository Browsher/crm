import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
import PaginaConfiguracao from './page'

const deps = vi.hoisted(() => ({ exigir: vi.fn(), vinculos: vi.fn(), vendedores: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('@/src/server/whatsapp/vinculos', () => ({ listarVinculos: deps.vinculos, listarVendedores: deps.vendedores }))
vi.mock('./acoes', () => ({ salvarVinculoAcao: vi.fn(), removerVinculoAcao: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.vendedores.mockResolvedValue([{ id: 'v1', nome: 'Ana' }])
  deps.vinculos.mockResolvedValue([{ id: 'l1', vendedorId: 'v1', nome: 'Ana', instancia: 'vendas-ana', ativo: true }, { id: 'l2', vendedorId: 'v2', nome: 'Bia', instancia: 'vendas-bia', ativo: false }])
})
test('lista vínculos indisponíveis mas só oferece vendedores ativos no formulário', async () => {
  const html = renderToStaticMarkup(await PaginaConfiguracao())
  expect(deps.exigir).toHaveBeenCalledWith('gestor')
  expect(html).toContain('value="v1"')
  expect(html).not.toContain('value="v2"')
  expect(html).toContain('vendas-bia')
  expect(html).toContain('Indisponível')
  expect(html).toContain('Salvar ou substituir vínculo')
  expect(html).toContain('Remover vínculo de Ana')
  expect(html).toContain('não exclui a conexão nem o histórico')
  expect(html).toContain('maxLength="100"')
})
test('nega acesso à página antes de listar', async () => {
  deps.exigir.mockRejectedValue(new Error('negado'))
  await expect(PaginaConfiguracao()).rejects.toThrow('negado')
  expect(deps.vinculos).not.toHaveBeenCalled()
  expect(deps.vendedores).not.toHaveBeenCalled()
})
test('estado vazio informa falta de vendedores e impede envio', async () => {
  deps.vendedores.mockResolvedValue([])
  deps.vinculos.mockResolvedValue([])
  const html = renderToStaticMarkup(await PaginaConfiguracao())
  expect(html).toContain('Nenhum vendedor ativo')
  expect(html).toContain('Nenhum vínculo cadastrado')
  expect(html).toMatch(/type="submit" disabled=""/)
})
