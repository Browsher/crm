// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ limites: vi.fn() }))
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'gestor' }) }))
vi.mock('@/src/features/busca-empresas/repositorio', () => ({ repositorioBusca: () => ({ listarLimites: mocks.limites, listar: async () => [] }) }))
vi.mock('./acoes', () => ({ salvarLimiteAcao: async () => ({ erro: null, salvo: true }) }))
import Pagina from './page'
let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => { if (raiz) await act(async () => raiz!.unmount()); host?.remove(); vi.unstubAllGlobals() })
test('confirmação de pausa permanece depois da revalidação dos limites pelo servidor', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const limite = { usuario_id: '11111111-1111-4111-8111-111111111111', vendedor: 'Vendedor', limite_diario: 10, pausado: false, usado: 2 }
  mocks.limites.mockResolvedValue([limite])
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  await act(async () => raiz!.render(await Pagina({ searchParams: Promise.resolve({}) })))
  await act(async () => host!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(host.textContent).toContain('Limite salvo.')
  mocks.limites.mockResolvedValue([{ ...limite, limite_diario: 5, pausado: true }])
  await act(async () => raiz!.render(await Pagina({ searchParams: Promise.resolve({}) })))
  expect(host.textContent).toContain('Limite salvo.')
})
