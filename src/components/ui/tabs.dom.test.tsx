// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { TabsIndicator, TabsList, TabsPanel, TabsRoot, TabsTab } from './tabs'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  host?.remove()
})

async function montar() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root!.render(<TabsRoot defaultValue="dados">
    <TabsList aria-label="Ficha da empresa"><TabsTab value="dados">Dados</TabsTab><TabsTab value="historico">Histórico</TabsTab><TabsIndicator /></TabsList>
    <TabsPanel value="dados" keepMounted>Dados cadastrais<input aria-label="Nota" defaultValue="" /></TabsPanel>
    <TabsPanel value="historico">Última ligação registrada</TabsPanel>
  </TabsRoot>))
}

test('ficha alterna o conteúdo e associa cada aba ao seu painel', async () => {
  await montar()
  const abas = host.querySelectorAll<HTMLButtonElement>('[role=tab]')
  expect(abas[0].getAttribute('aria-selected')).toBe('true')
  expect(host.querySelector('[role=tabpanel]')?.textContent).toBe('Dados cadastrais')
  await act(async () => abas[1].click())
  expect(abas[1].getAttribute('aria-selected')).toBe('true')
  expect(abas[0].getAttribute('aria-selected')).toBe('false')
  const painel = document.getElementById(abas[1].getAttribute('aria-controls')!)
  expect(painel?.textContent).toBe('Última ligação registrada')
  expect(painel?.getAttribute('aria-labelledby')).toBe(abas[1].id)
})

test('teclado navega entre abas sem criar paradas extras no Tab', async () => {
  await montar()
  const abas = host.querySelectorAll<HTMLButtonElement>('[role=tab]')
  await act(async () => abas[0].focus())
  await act(async () => abas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(document.activeElement).toBe(abas[1])
  await act(async () => abas[1].click())
  expect(abas[1].tabIndex).toBe(0)
  expect(abas[0].tabIndex).toBe(-1)
})


test('painel keepMounted conserva o rascunho ao trocar por setas e retornar', async () => {
  await montar()
  const abas = host.querySelectorAll<HTMLButtonElement>('[role=tab]')
  const nota = host.querySelector<HTMLInputElement>('[aria-label="Nota"]')!
  nota.value = 'Rascunho preservado entre abas'
  await act(async () => abas[0].focus())
  await act(async () => abas[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  await act(async () => abas[1].click())
  expect(nota.isConnected).toBe(true)
  expect(nota.value).toBe('Rascunho preservado entre abas')
  await act(async () => abas[0].click())
  expect(host.querySelector('[aria-label="Nota"]')).toBe(nota)
})
