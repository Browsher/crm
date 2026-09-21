import { beforeEach, expect, test, vi } from 'vitest'
import { historicoMensagensAcao } from './historico-acao'

const mocks = vi.hoisted(() => ({ exigir: vi.fn(), ler: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/server/whatsapp/evolution', () => ({ lerPaginaMensagens: mocks.ler }))
const limite = '2026-09-21T20:00:00.000Z'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exigir.mockResolvedValue({ papel: 'gestor' })
  mocks.ler.mockResolvedValue({ configurado: true, total: 590, mensagens: [], limiteHistorico: limite, temMais: true })
})
test('exige gestor antes de ler histórico', async () => {
  mocks.exigir.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(historicoMensagensAcao(2, limite)).rejects.toThrow('NEXT_REDIRECT')
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).not.toHaveBeenCalled()
})
test.each([0, 1, -1, 2.5, NaN, 100001, '2'])('recusa página inválida %s sem consultar Evolution', async pagina => {
  expect(await historicoMensagensAcao(pagina as number, limite)).toEqual({ ok: false, motivo: 'parametros_invalidos' })
  expect(mocks.ler).not.toHaveBeenCalled()
})
test.each(['', 'abc', '2026-02-30T00:00:00.000Z', null])('recusa limite inválido %s', async limiteInvalido => {
  expect(await historicoMensagensAcao(2, limiteInvalido as string)).toEqual({ ok: false, motivo: 'parametros_invalidos' })
  expect(mocks.ler).not.toHaveBeenCalled()
})
test('consulta a página autorizada com o limite recebido sem trocar a instância', async () => {
  expect(await historicoMensagensAcao(2, limite)).toEqual({ ok: true, mensagens: [], temMais: true })
  expect(mocks.exigir).toHaveBeenCalledWith('gestor')
  expect(mocks.ler).toHaveBeenCalledWith(2, limite)
})
test('falha externa não vaza chave nem se apresenta como fim do histórico', async () => {
  mocks.ler.mockRejectedValue(new Error('apikey segredo-sintetico'))
  expect(await historicoMensagensAcao(2, limite)).toEqual({ ok: false, motivo: 'indisponivel' })
})
test('configuração ausente é distinta de histórico vazio', async () => {
  mocks.ler.mockResolvedValue({ configurado: false })
  expect(await historicoMensagensAcao(2, limite)).toEqual({ ok: false, motivo: 'nao_configurado' })
})
