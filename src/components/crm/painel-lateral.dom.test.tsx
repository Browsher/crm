// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PainelLateralCrm } from './painel-lateral'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement | undefined

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  host?.remove()
  root = undefined
})

test('painel anuncia título, recebe foco e deixa o quadro disponível', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<>
    <button type="button">Quadro</button>
    <PainelLateralCrm titulo="Negociação" descricao="Em negociação" aoFechar={fechar}>
      <button type="button">Registrar</button>
    </PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside[data-painel-lateral]')!
  expect(painel.getAttribute('aria-modal')).toBeNull()
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  const titulo = painel.querySelector('h2')!
  expect(painel.getAttribute('aria-labelledby')).toBe(titulo.id)
  expect(document.activeElement).toBe(titulo)
  expect(host.querySelector('button')?.disabled).toBe(false)
  await act(async () => titulo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).toHaveBeenCalledOnce()
})

test('envio pendente impede fechamento pelo botão e Escape', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<PainelLateralCrm titulo="Negociação" fecharBloqueado aoFechar={fechar}>Enviando</PainelLateralCrm>))
  const botao = host.querySelector('button')!
  expect(botao.disabled).toBe(true)
  await act(async () => host?.querySelector('h2')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).not.toHaveBeenCalled()
})


test('rótulo Voltar usa o mesmo fechamento pelo botão e Escape', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<PainelLateralCrm titulo="Empresa" rotuloFechar="Voltar" aoFechar={fechar}>Dados</PainelLateralCrm>))
  const botao = host.querySelector('button')!
  expect(botao.textContent).toBe('Voltar')
  await act(async () => botao.click())
  await act(async () => botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).toHaveBeenCalledTimes(2)
})
