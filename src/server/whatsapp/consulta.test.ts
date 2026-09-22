import { beforeEach, expect, test, vi } from 'vitest'
import { consultarFontes, resolverFontes } from './consulta'

const mocks = vi.hoisted(() => ({ listar: vi.fn(), ler: vi.fn(), empresas: vi.fn() }))
vi.mock('./empresas', () => ({ consultarEmpresas: mocks.empresas }))
vi.mock('./vinculos', () => ({ listarVinculos: mocks.listar }))
vi.mock('./evolution', () => ({ lerPaginaMensagens: mocks.ler }))
const a = { id: 'a', vendedorId: 'va', nome: 'Ana', instancia: 'ana', ativo: true }
const b = { id: 'b', vendedorId: 'vb', nome: 'Bruno', instancia: 'bruno', ativo: true }
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('EVOLUTION_INSTANCE_NAME', 'teste')
  mocks.listar.mockResolvedValue([a, b])
  mocks.empresas.mockResolvedValue({})
  mocks.ler.mockResolvedValue({ configurado: true, total: 1, temMais: false, mensagens: [{ id: 'igual', conversa: 'mesmo@lid', em: '2026-09-22T12:00:00Z' }] })
})
test('Todos separa piloto; filtro desconhecido não cai no piloto', async () => {
  expect((await resolverFontes('gestor', 'todos')).fontes.map(f => f.id)).toEqual(['a', 'b'])
  expect((await resolverFontes('gestor', 'piloto')).fontes.map(f => f.instancia)).toEqual(['teste'])
  expect((await resolverFontes('gestor', 'inexistente')).fontes).toEqual([])
})
test('instância piloto vinculada não aparece duplicada; inativo não libera consulta', async () => {
  mocks.listar.mockResolvedValue([{ ...a, instancia: 'teste' }, { ...b, ativo: false }])
  expect((await resolverFontes('gestor', 'piloto')).fontes).toEqual([])
  expect((await resolverFontes('gestor', 'b')).fontes).toEqual([])
})
test('Todos não reabre piloto quando existem vínculos mas todos ficam inativos', async () => {
  mocks.listar.mockResolvedValue([{ ...a, ativo: false }])
  expect((await resolverFontes('gestor', 'todos')).fontes).toEqual([])
  expect((await resolverFontes('gestor', 'piloto')).fontes).toHaveLength(1)
})
test('fontes distintas conservam mensagens com mesmo ID e conversa', async () => {
  const r = await consultarFontes('gestor', 'todos')
  expect(r.mensagens.map(m => m.fonteId)).toEqual(['a', 'b'])
  expect(r.mensagens.map(m => m.vendedor)).toEqual(['Ana', 'Bruno'])
})
test('falha parcial conserva cursor; sucesso avança e tentativa seguinte só consulta pendentes', async () => {
  mocks.ler.mockImplementation(async (_p, _l, instancia) => {
    if (instancia === 'bruno') throw new Error('segredo')
    return { configurado: true, total: 1, temMais: false, mensagens: [] }
  })
  const r = await consultarFontes('gestor', 'todos')
  expect(r.avisos).toEqual(['Bruno'])
  expect(r.cursores.b.pagina).toBe(1)
  expect(r.cursores.a.pagina).toBe(2)
  expect(r.cursores.a.temMais).toBe(false)
  mocks.ler.mockClear()
  await consultarFontes('gestor', 'todos', r.cursores)
  expect(mocks.ler).toHaveBeenCalledTimes(1)
  expect(mocks.ler.mock.calls[0][2]).toBe('bruno')
})
test('cursor forjado e vínculo removido não fazem consulta', async () => {
  await expect(consultarFontes('gestor', 'todos', { fora: { pagina: 2, limite: '2026-09-22T12:00:00.000Z', temMais: true } })).rejects.toThrow()
  expect(mocks.ler).not.toHaveBeenCalled()
})

test('enriquece mensagens com empresa por telefone confirmado e mantém mensagens quando CRM falha', async () => {
  const mensagem = { id: '1', conversa: 'cliente@lid', telefone: '+5511911111111', em: '2026-09-22T12:00:00Z' }
  mocks.ler.mockResolvedValue({ configurado: true, total: 1, temMais: false, mensagens: [mensagem] })
  const cadastro = { telefone: mensagem.telefone, estado: 'encontrada', empresa: { id: 'empresa', nome: 'Loja' } }
  mocks.empresas.mockResolvedValue({ [mensagem.telefone]: cadastro })
  expect((await consultarFontes('gestor', 'a')).mensagens[0].cadastro).toEqual(cadastro)
  mocks.empresas.mockRejectedValue(new Error('segredo do banco'))
  const r = await consultarFontes('gestor', 'a')
  expect(r.mensagens[0]).toMatchObject({ id: '1', cadastro: { telefone: mensagem.telefone, estado: 'indisponivel' } })
  expect(JSON.stringify(r)).not.toContain('segredo')
})
