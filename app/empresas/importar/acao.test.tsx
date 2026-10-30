import { beforeEach, expect, test, vi } from 'vitest'
import { importarAcao } from './acao'
import { exigir } from '@/src/server/autenticacao/guarda'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
const inicial = { erro: null, relatorio: null, inseridas: null, grupoId: null, conferencia: null }

test.each(['conferir', 'confirmar', 'limpar'])('aba antiga recebe recusa ao tentar %s sem ler o formulário', async operacao => {
  const form = new FormData()
  form.set(operacao, '1')
  const ler = vi.spyOn(form, 'get')
  const r = await importarAcao(inicial, form)
  expect(exigir).toHaveBeenCalledWith('gestor')
  expect(r).toEqual({ ...inicial, erro: 'A importação manual de empresas foi desativada.' })
  expect(ler).not.toHaveBeenCalled()
})

test('ação antiga exige gestor antes de responder', async () => {
  vi.mocked(exigir).mockRejectedValueOnce(new Error('acesso recusado'))
  await expect(importarAcao(inicial, new FormData())).rejects.toThrow('acesso recusado')
})
