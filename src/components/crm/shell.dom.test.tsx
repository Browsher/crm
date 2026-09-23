// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { ShellCrm } from './shell'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.mock('next/navigation', () => ({ usePathname: () => '/whatsapp' }))

test.each(['gestor', 'vendedor'] as const)('recolhe e expande a lateral do %s mantendo nomes e saída POST', async papel => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<ShellCrm nome="Ana" papel={papel} area={papel === 'gestor' ? 'whatsapp' : 'carteira'}>Conteúdo</ShellCrm>))
    const botao = () => host.querySelector<HTMLButtonElement>('button[aria-label="Recolher barra lateral"], button[aria-label="Expandir barra lateral"]')
    expect(botao()).not.toBeNull()
    expect(botao()!.getAttribute('aria-expanded')).toBe('true')
    await act(async () => botao()!.click())
    expect(botao()!.getAttribute('aria-expanded')).toBe('false')
    expect(botao()!.getAttribute('aria-label')).toBe('Expandir barra lateral')
    const nav = host.querySelector('nav[aria-label="Navegação do CRM"]')!
    expect(nav.textContent).toContain(papel === 'gestor' ? 'WhatsApp' : 'Carteira')
    if (papel === 'vendedor') expect(nav.querySelector('a[href="/usuarios"]')).toBeNull()
    expect(host.querySelector('form[action="/sair"]')?.getAttribute('method')).toBe('post')
    await act(async () => botao()!.click())
    expect(botao()!.getAttribute('aria-expanded')).toBe('true')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
