// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PainelLateralCrm } from './painel-lateral'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  document.body.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('overflow')
  vi.unstubAllGlobals()
})

test('guarda móvel contém Tab, Shift+Tab e foco programático no painel', async () => {
  await act(async () => root.render(<>
    <button data-fundo>Quadro</button>
    <PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={<button>Salvar</button>}>
      <input aria-label="Nome" /><button disabled>Indisponível</button>
      <button hidden>Oculto</button>
    </PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside')!
  const fechar = painel.querySelector('button')!
  const salvar = Array.from(painel.querySelectorAll('button')).find(botao => botao.textContent === 'Salvar')!
  expect(document.activeElement).toBe(painel.querySelector('h2'))
  await act(async () => {
    salvar?.focus()
    salvar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  })
  expect(document.activeElement).toBe(fechar)
  await act(async () => fechar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(salvar)
  await act(async () => (host.querySelector('[data-fundo]') as HTMLElement).focus())
  expect(painel.contains(document.activeElement)).toBe(true)
})

test('cleanup conserva inert e overflow anteriores e libera somente o que alterou', async () => {
  document.body.style.setProperty('overflow', 'clip', 'important')
  document.documentElement.style.overflow = 'scroll'
  await act(async () => root.render(<>
    <div data-inerte inert><button>Anteriormente inerte</button></div>
    <div data-livre><button>Quadro</button></div>
    <PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={null}>Dados</PainelLateralCrm>
  </>))
  const inerte = host.querySelector('[data-inerte]')!
  const livre = host.querySelector('[data-livre]')!
  expect(livre.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  await act(async () => root.render(<>
    <div data-inerte inert><button>Anteriormente inerte</button></div>
    <div data-livre><button>Quadro</button></div>
  </>))
  expect(inerte.hasAttribute('inert')).toBe(true)
  expect(livre.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('clip')
  expect(document.body.style.getPropertyPriority('overflow')).toBe('important')
  expect(document.documentElement.style.overflow).toBe('scroll')
})

test('cleanup não sobrescreve estilos alterados por outro dono durante o painel', async () => {
  await act(async () => root.render(<PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={null}>Dados</PainelLateralCrm>))
  expect(document.body.style.overflow).toBe('hidden')
  document.body.style.overflow = 'clip'
  await act(async () => root.render(null))
  expect(document.body.style.overflow).toBe('clip')
})

test('composição legada não torna o fundo inerte nem bloqueia a rolagem móvel', async () => {
  await act(async () => root.render(<>
    <button data-fundo>Quadro</button>
    <PainelLateralCrm titulo="Legado" aoFechar={() => {}}>Dados</PainelLateralCrm>
  </>))
  expect(host.querySelector('[data-fundo]')?.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('')
  expect(host.querySelector('aside')?.hasAttribute('data-painel-composicao')).toBe(false)
})
