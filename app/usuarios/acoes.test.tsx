import { beforeEach, expect, test, vi } from 'vitest'
import { agirNaLinhaAcao, criarUsuarioAcao } from './acoes'

const deps = vi.hoisted(() => ({ exigir: vi.fn(), criar: vi.fn(), novaSenha: vi.fn(), revalidar: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: deps.revalidar }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('@/src/features/usuarios/repositorio', () => ({ repositorioPostgres: () => ({}) }))
vi.mock('@/src/features/usuarios/servico', () => ({ criarUsuario: deps.criar, novaSenhaProvisoria: deps.novaSenha }))

beforeEach(() => {
  vi.resetAllMocks()
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
})

test('erro após gravação confirmada conserva o usuário criado e a única entrega da senha', async () => {
  const senhaProvisoria = crypto.randomUUID()
  deps.criar.mockResolvedValue({ ok: true, senhaProvisoria })
  deps.revalidar.mockImplementation(() => { throw new Error('cache indisponível') })
  const form = new FormData()
  form.set('nome', 'Pessoa de teste')
  const resultado = await criarUsuarioAcao({ erro: null, criado: null }, form)
  expect(resultado).toMatchObject({ erro: null, criado: { nome: 'Pessoa de teste' } })
  expect(resultado.criado?.senhaProvisoria === senhaProvisoria).toBe(true)
  expect(resultado).toHaveProperty('aviso', expect.stringContaining('Atualize'))
  expect(deps.criar).toHaveBeenCalledTimes(1)
})

test('resultado de nova senha desconhecido pede conferência sem devolver segredo', async () => {
  deps.novaSenha.mockRejectedValue(new Error('falha interna'))
  const form = new FormData()
  form.set('acao', 'nova_senha')
  const resultado = await agirNaLinhaAcao({ erro: null, senhaProvisoria: null }, form)
  expect(resultado).toMatchObject({ senhaProvisoria: null, incerto: true })
  expect(resultado.erro).toContain('confira')
})

test('redirecionamento de guarda não é convertido em estado da mutação', async () => {
  deps.exigir.mockRejectedValue(new Error('redirecionamento da guarda'))
  await expect(criarUsuarioAcao({ erro: null, criado: null }, new FormData())).rejects.toThrow('redirecionamento da guarda')
  expect(deps.criar).not.toHaveBeenCalled()
})
