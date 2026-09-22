import { beforeEach, expect, test, vi } from 'vitest'
import { removerVinculoAcao, salvarVinculoAcao } from './acoes'

const deps = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn(), salvar: vi.fn(), remover: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('@/src/server/whatsapp/evolution', () => ({ lerPaginaMensagens: deps.ler }))
vi.mock('@/src/server/whatsapp/vinculos', () => ({ salvarVinculo: deps.salvar, removerVinculo: deps.remover }))
vi.mock('next/cache', () => ({ revalidatePath: deps.revalidate }))
const id = '11111111-1111-4111-8111-111111111111'
const inicial = { erro: null, sucesso: null }
function form(vendedorId = id, instancia = '  vendas-ana  ') {
  const dados = new FormData()
  dados.set('vendedorId', vendedorId)
  dados.set('instancia', instancia)
  dados.set('id', vendedorId)
  return dados
}
beforeEach(() => {
  vi.resetAllMocks()
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.ler.mockResolvedValue({ configurado: true })
  deps.salvar.mockResolvedValue({ ok: true })
  deps.remover.mockResolvedValue({ ok: true })
})
test.each([salvarVinculoAcao, removerVinculoAcao])('nega ação antes de acessar dependências', async acao => {
  deps.exigir.mockRejectedValue(new Error('acesso negado'))
  await expect(acao(inicial, form())).rejects.toThrow('acesso negado')
  expect(deps.exigir).toHaveBeenCalledWith('gestor')
  expect(deps.ler).not.toHaveBeenCalled()
  expect(deps.salvar).not.toHaveBeenCalled()
  expect(deps.remover).not.toHaveBeenCalled()
})
test.each([['inválido', 'ana'], [id, ''], [id, 'a'.repeat(101)], [id, 'a\nna'], [id, '\tana']])('recusa entrada inválida antes da Evolution', async (vendedor, instancia) => {
  expect((await salvarVinculoAcao(inicial, form(vendedor, instancia))).erro).toBeTruthy()
  expect(deps.ler).not.toHaveBeenCalled()
  expect(deps.salvar).not.toHaveBeenCalled()
})
test('valida consulta da instância exata antes de salvar ou substituir', async () => {
  expect((await salvarVinculoAcao(inicial, form())).sucesso).toBeTruthy()
  expect(deps.ler).toHaveBeenCalledWith(1, expect.any(String), 'vendas-ana')
  expect(deps.salvar).toHaveBeenCalledWith('gestor', id, 'vendas-ana')
  expect(deps.ler.mock.invocationCallOrder[0]).toBeLessThan(deps.salvar.mock.invocationCallOrder[0])
  expect(deps.revalidate.mock.calls.map(c => c[0])).toEqual(['/whatsapp', '/whatsapp/configuracao'])
})
test('instância não configurada não é persistida', async () => {
  deps.ler.mockResolvedValue({ configurado: false })
  expect((await salvarVinculoAcao(inicial, form())).erro).toBeTruthy()
  expect(deps.salvar).not.toHaveBeenCalled()
})
test('falha externa é sanitizada e não salva', async () => {
  deps.ler.mockRejectedValue(new Error('apikey segredo https://interno'))
  const estado = await salvarVinculoAcao(inicial, form())
  expect(estado.erro).toBeTruthy()
  expect(JSON.stringify(estado)).not.toMatch(/segredo|interno|apikey/)
  expect(deps.salvar).not.toHaveBeenCalled()
})
test.each(['instancia_em_uso', 'vendedor_invalido', 'sem_permissao', 'erro segredo'])('recusa do banco %s é recuperável e segura', async motivo => {
  deps.salvar.mockResolvedValue({ ok: false, motivo })
  const estado = await salvarVinculoAcao(inicial, form())
  expect(estado.erro).toBeTruthy()
  expect(estado.sucesso).toBeNull()
  expect(estado.erro).not.toContain('segredo')
  expect(deps.revalidate).not.toHaveBeenCalled()
})
test('remove somente vínculo identificado sem consultar Evolution', async () => {
  expect((await removerVinculoAcao(inicial, form())).sucesso).toBeTruthy()
  expect(deps.remover).toHaveBeenCalledWith('gestor', id)
  expect(deps.ler).not.toHaveBeenCalled()
})
test('remoção inválida e falha de infraestrutura não vazam dados', async () => {
  expect((await removerVinculoAcao(inicial, form('inválido'))).erro).toBeTruthy()
  expect(deps.remover).not.toHaveBeenCalled()
  deps.remover.mockRejectedValue(new Error('segredo'))
  const estado = await removerVinculoAcao(inicial, form())
  expect(estado.erro).toBeTruthy()
  expect(estado.erro).not.toContain('segredo')
})
