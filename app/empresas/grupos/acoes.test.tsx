import { beforeEach, expect, test, vi } from 'vitest'
import { alterarGrupoAcao } from './acoes'
const deps = vi.hoisted(() => ({ exigir: vi.fn(), renomear: vi.fn(), situacao: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: deps.exigir }))
vi.mock('@/src/features/empresas/grupos', () => ({ renomearGrupo: deps.renomear, definirSituacaoGrupo: deps.situacao }))
vi.mock('next/cache', () => ({ revalidatePath: deps.revalidate }))
const id = '11111111-1111-4111-8111-111111111111'
function form(acao: string) {
  const dados = new FormData()
  dados.set('id', id)
  dados.set('acao', acao)
  dados.set('nome', 'Centro')
  dados.set('impacto', '999999')
  return dados
}
beforeEach(() => {
  vi.clearAllMocks()
  deps.exigir.mockResolvedValue({ usuarioId: 'gestor' })
  deps.renomear.mockResolvedValue({ ok: true })
  deps.situacao.mockResolvedValue({ ok: true })
})
test.each(['renomear', 'desativar', 'reativar'])('guarda gestor precede mutação %s e invalida todos os consumidores', async acao => {
  expect(await alterarGrupoAcao({ erro: null, sucesso: false }, form(acao))).toEqual({ erro: null, sucesso: true })
  expect(deps.exigir).toHaveBeenCalledWith('gestor')
  expect(deps.revalidate.mock.calls.map(c => c[0])).toEqual(['/empresas/grupos', `/empresas/grupos/${id}`, '/fila', '/fila/localizar'])
  if (acao === 'renomear') expect(deps.renomear).toHaveBeenCalledWith('gestor', id, 'Centro')
  else expect(deps.situacao).toHaveBeenCalledWith('gestor', id, acao === 'reativar')
})
test('guarda recusada não altera nada', async () => {
  deps.exigir.mockRejectedValue(new Error('negado'))
  await expect(alterarGrupoAcao({ erro: null, sucesso: false }, form('desativar'))).rejects.toThrow('negado')
  expect(deps.situacao).not.toHaveBeenCalled()
})
test('ação desconhecida e SQL negado permanecem recuperáveis sem invalidar cache', async () => {
  expect((await alterarGrupoAcao({ erro: null, sucesso: false }, form('apagar'))).erro).toBeTruthy()
  deps.situacao.mockResolvedValue({ ok: false, motivo: 'sem_permissao' })
  expect((await alterarGrupoAcao({ erro: null, sucesso: false }, form('desativar'))).erro).toContain('permissão')
  expect(deps.revalidate).not.toHaveBeenCalled()
})
