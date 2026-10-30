import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ exigir: vi.fn(), incluir: vi.fn(), resumos: vi.fn(), repo: {} }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: mocks.exigir }))
vi.mock('@/src/features/busca-empresas/repositorio', () => ({ repositorioBusca: () => mocks.repo }))
vi.mock('@/src/features/busca-empresas/inclusao-automatica', () => ({ garantirInclusao: mocks.incluir }))
vi.mock('@/src/server/atendimento/consulta', () => ({ lerResumosBusca: mocks.resumos }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { concluirInclusaoAcao } from './acoes'
const inicial = { erro: null, grupoId: null, inseridas: 0, vinculadas: 0 }
const form = () => { const f = new FormData(); f.set('busca', 'busca-propria'); return f }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exigir.mockResolvedValue({ usuarioId: 'vendedor-real' })
  mocks.incluir.mockResolvedValue({ ok: true, grupoId: 'grupo', inseridas: 1, vinculadas: 1 })
})
test('inclusão confirmada devolve leitura canônica autorizada para atualizar o mesmo resultado', async () => {
  const empresas = [{ id: 'empresa', cnpj: '12345678000190', situacao: 'a_contatar', versao: 1 }]
  mocks.resumos.mockResolvedValue({ ok: true, empresas })
  expect(await concluirInclusaoAcao(inicial, form())).toMatchObject({ concluido: true, inseridas: 1, resumos: empresas })
  expect(mocks.resumos).toHaveBeenCalledExactlyOnceWith('vendedor-real', 'busca-propria')
  expect(mocks.incluir).toHaveBeenCalledExactlyOnceWith(mocks.repo, 'busca-propria')
})
test.each(['falha', 'negada'])('leitura %s preserva confirmação sem repetir inclusão', async tipo => {
  if (tipo === 'falha') mocks.resumos.mockRejectedValue(new Error('leitura indisponível'))
  else mocks.resumos.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })
  const resultado = await concluirInclusaoAcao(inicial, form())
  expect(resultado).toMatchObject({ erro: null, concluido: true, grupoId: 'grupo', inseridas: 1, vinculadas: 1 })
  expect(resultado).toHaveProperty('aviso', expect.stringContaining('inclusão foi concluída'))
  expect(mocks.incluir).toHaveBeenCalledTimes(1)
})
