// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

const m = vi.hoisted(() => ({ restaurando: false, replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace }) }))
vi.mock('@/src/components/crm/guarda-painel-edicao', () => ({
  useGuardaPainelEdicao: () => ({ restaurando: m.restaurando }),
}))
import { RedirecionarAtendimento } from './redirecionar'

let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement | undefined
afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  m.replace.mockClear()
  m.restaurando = false
})

test('espera retirar a entrada duplicada antes de substituir pela rota canônica', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const destino = '/fila/atendimento/empresa?nome=Aurora&pagina=3'
  m.restaurando = true
  await act(async () => root?.render(<RedirecionarAtendimento destino={destino} />))
  expect(host.textContent).toBe('Abrindo atendimento…')
  expect(m.replace).not.toHaveBeenCalled()

  m.restaurando = false
  await act(async () => root?.render(<RedirecionarAtendimento destino={destino} />))
  expect(m.replace).toHaveBeenCalledExactlyOnceWith(destino)
  await act(async () => root?.render(<RedirecionarAtendimento destino={destino} />))
  expect(m.replace).toHaveBeenCalledOnce()
})
