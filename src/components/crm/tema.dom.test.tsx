// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { ShellCrm } from './shell'
import { TemaCrmProvider, useControleTemaCrm, useTemaCrm } from './tema'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function Controles() {
  const { definirTema } = useControleTemaCrm()
  return <><span data-preferencia>{useTemaCrm()}</span><button onClick={() => definirTema('dark')}>Escuro</button><button onClick={() => definirTema('system')}>Sistema</button></>
}

test('tema explícito prevalece e Sistema volta a acompanhar a preferência do dispositivo', async () => {
  let escuro = false
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', () => ({ get matches() { return escuro }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) }))
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<TemaCrmProvider><Controles /></TemaCrmProvider>))
    expect(document.documentElement.dataset.theme).toBe('light')
    await act(async () => host.querySelectorAll('button')[0].click())
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(host.querySelector('[data-preferencia]')?.textContent).toBe('dark')
    await act(async () => host.querySelectorAll('button')[1].click())
    expect(document.documentElement.dataset.theme).toBe('light')
    await act(async () => { escuro = true; listeners.forEach(fn => fn()) })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(host.querySelector('[data-preferencia]')?.textContent).toBe('system')
  } finally {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  }
})


vi.mock('next/navigation', () => ({ usePathname: () => '/design' }))

test('tema escolhido na Gestão acompanha a galeria e volta à Gestão', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const tela = (design: boolean) => <TemaCrmProvider><ShellCrm key={design ? 'design' : 'gestao'} nome="Ana" papel="gestor" area={design ? 'design' : 'gestao'}>Conteúdo</ShellCrm></TemaCrmProvider>
  try {
    await act(async () => root.render(tela(false)))
    const seletor = host.querySelector('select')!
    await act(async () => {
      seletor.value = 'dark'
      seletor.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => root.render(tela(true)))
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Tema do design system"]')?.value).toBe('dark')
    await act(async () => root.render(tela(false)))
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Tema da Gestão"]')?.value).toBe('dark')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
