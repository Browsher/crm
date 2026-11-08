// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { Dialog, DialogContent } from '@/src/components/ui/dialog'
import { ConfirmacaoPainelCrm } from './confirmacao-painel'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
test('confirmação compõe o diálogo do dono e conserva seus callbacks', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host), confirmar = vi.fn()
  await act(async () => root.render(<Dialog open><DialogContent showCloseButton={false}><ConfirmacaoPainelCrm titulo="Confirmar venda" alvo={<strong>Aurora · R$ 25,00 · 06/11/2026</strong>} descricao="A empresa seguirá para a Carteira." acoes={<button onClick={confirmar}>Confirmar</button>}><p role="alert">Confira os dados</p></ConfirmacaoPainelCrm></DialogContent></Dialog>))
  expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1)
  expect(document.querySelector('[data-confirmacao-alvo]')?.textContent).toContain('Aurora')
  expect(document.querySelector('[role=dialog]')?.getAttribute('aria-describedby')).toBeTruthy()
  await act(async () => document.querySelector<HTMLButtonElement>('button')!.click())
  expect(confirmar).toHaveBeenCalledOnce()
  expect(document.querySelector('[role=dialog]')).not.toBeNull()
  await act(async () => root.unmount()); host.remove()
})
