import { beforeEach, expect, test, vi } from 'vitest'
import { lerAtendimentoDaListaAcao } from './leitura-acao'

const m = vi.hoisted(() => ({ exigir: vi.fn(), recentes: vi.fn(), banco: vi.fn(), google: vi.fn(), detalhe: vi.fn(), atendimento: vi.fn(), historico: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: m.exigir }))
vi.mock('@/src/features/busca-empresas/repositorio', () => ({ repositorioBusca: m.banco }))
vi.mock('@/src/features/google/repositorio', () => ({ repositorioGoogle: m.google }))
vi.mock('@/src/server/atendimento/consulta', () => ({ lerAtendimento: m.atendimento }))
vi.mock('@/src/features/contato/historico', () => ({ lerHistorico: m.historico }))

const recentes = { tipo: 'recentes' } as const
const google = { tipo: 'google', pedidoId: 'entrega', pagina: 2 } as const
const empresa = { id: 'empresa' }

beforeEach(() => {
  vi.resetAllMocks()
  m.exigir.mockResolvedValue({ usuarioId: 'vendedor-da-sessao' })
  m.banco.mockReturnValue({ empresasRecentes: m.recentes })
  m.google.mockReturnValue({ detalhe: m.detalhe })
  m.atendimento.mockResolvedValue({ ok: true, empresa, fase: 'inicial' })
  m.historico.mockResolvedValue({ ok: true, contatos: [] })
})

test('autoriza o vendedor antes de consultar a lista ou o atendimento', async () => {
  m.exigir.mockRejectedValueOnce(new Error('sessão necessária'))
  await expect(lerAtendimentoDaListaAcao(recentes, empresa.id)).rejects.toThrow('sessão necessária')
  expect(m.exigir).toHaveBeenCalledWith('vendedor')
  expect(m.banco).not.toHaveBeenCalled()
  expect(m.atendimento).not.toHaveBeenCalled()
})

test('Últimas buscas autoriza só a empresa vinculada que aparece no carrossel', async () => {
  m.recentes.mockResolvedValueOnce([{ empresaId: 'outra' }]).mockResolvedValueOnce([{ empresaId: empresa.id }])
  expect(await lerAtendimentoDaListaAcao(recentes, empresa.id)).toMatchObject({ ok: false })
  expect(m.atendimento).not.toHaveBeenCalled()
  expect(m.historico).not.toHaveBeenCalled()
  expect(await lerAtendimentoDaListaAcao(recentes, empresa.id)).toMatchObject({ ok: true, dados: { empresaId: empresa.id, filtros: { origem: 'banco' } } })
  expect(m.banco).toHaveBeenCalledWith('vendedor-da-sessao')
  expect(m.atendimento).toHaveBeenCalledExactlyOnceWith('vendedor-da-sessao', empresa.id)
})

test('Google exige que a empresa esteja na página da entrega do vendedor', async () => {
  const plano = { vendedor_id: 'vendedor-da-sessao' }
  m.detalhe.mockResolvedValueOnce(null).mockResolvedValueOnce({ plano, resultados: [{ empresa_id: 'outra' }] })
    .mockResolvedValueOnce({ plano: { vendedor_id: 'outro-vendedor' }, resultados: [{ empresa_id: empresa.id }] })
    .mockResolvedValueOnce({ plano, resultados: [{ empresa_id: empresa.id }] })
  expect(await lerAtendimentoDaListaAcao(google, empresa.id)).toMatchObject({ ok: false })
  expect(await lerAtendimentoDaListaAcao(google, empresa.id)).toMatchObject({ ok: false })
  expect(await lerAtendimentoDaListaAcao(google, empresa.id)).toMatchObject({ ok: false })
  expect(m.historico).not.toHaveBeenCalled()
  expect(await lerAtendimentoDaListaAcao(google, empresa.id)).toMatchObject({ ok: true, dados: { empresaId: empresa.id, filtros: { origem: 'google' } } })
  expect(m.google).toHaveBeenCalledWith('vendedor-da-sessao')
  expect(m.detalhe).toHaveBeenCalledWith('entrega', 2)
  expect(m.historico).toHaveBeenCalledExactlyOnceWith('vendedor-da-sessao', empresa.id)
})

test('falha do histórico devolve aviso recuperável e não vaza detalhes internos', async () => {
  m.recentes.mockResolvedValueOnce([{ empresaId: empresa.id }])
  m.historico.mockRejectedValueOnce(new Error('detalhe privado'))
  expect(await lerAtendimentoDaListaAcao(recentes, empresa.id)).toEqual({ ok: false, erro: 'Não foi possível carregar o atendimento. Tente novamente.' })
})
