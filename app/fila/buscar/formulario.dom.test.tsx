// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { FormularioBusca } from './formulario'
vi.mock('./acoes', () => ({ buscarEmpresasAcao: vi.fn() }))
let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => { if (raiz) await act(async () => raiz!.unmount()); host?.remove(); vi.unstubAllGlobals() })
test('nova busca confirmada recebe outro UUID e atualização da mesma tentativa preserva sua identidade', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  const primeira = '11111111-1111-4111-8111-111111111111'
  const segunda = '22222222-2222-4222-8222-222222222222'
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={10} chaveInicial={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(primeira)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial={segunda} buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial="33333333-3333-4333-8333-333333333333" buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
})
