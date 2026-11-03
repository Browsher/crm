import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import Pagina from './page'
import { exigir } from '@/src/server/autenticacao/guarda'

vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: vi.fn() }))
vi.mock('./acao', () => ({ trocarSenhaAcao: vi.fn() }))

test.each([true, false])('exibe saídas adequadas quando senha provisória pendente é %s', async (pendente) => {
  vi.mocked(exigir).mockResolvedValue({ senhaProvisoriaPendente: pendente } as Awaited<ReturnType<typeof exigir>>)
  const html = renderToStaticMarkup(await Pagina())
  expect(exigir).toHaveBeenCalledWith('sessao')
  expect(html).toContain('action="/sair"')
  expect(html).toContain('method="post"')
  expect(html.includes('Voltar ao CRM')).toBe(!pendente)
})
