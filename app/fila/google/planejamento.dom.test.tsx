// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PlanejamentoSemanal } from './planejamento'

vi.mock('./acoes', () => ({ salvarPlanoAcao: async () => ({ erro: null, salvo: true }) }))
const elemento = document.createElement('div')
document.body.append(elemento)
let raiz: ReturnType<typeof createRoot> | undefined
afterEach(async () => { await act(async () => raiz?.unmount()); elemento.replaceChildren() })
test('cada dia tem ação explícita e dias passados não podem ser editados', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']} planos={[]} hoje="2026-10-22" rotinaIniciada={false} />))
  const botoes = Array.from(elemento.querySelectorAll('button'))
  expect(botoes.filter(b => b.disabled)).toHaveLength(3)
  expect(botoes.filter(b => !b.disabled)).toHaveLength(2)
  expect(elemento.querySelector('[onclick]')).toBeNull()
})
test('snapshot do dia bloqueia novos pedidos mesmo quando o vendedor ainda não tinha plano', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-22']} planos={[]} hoje="2026-10-22" rotinaIniciada />))
  expect(elemento.querySelector('button')?.disabled).toBe(true)
  expect(elemento.textContent).toContain('Sem pedido')
})
