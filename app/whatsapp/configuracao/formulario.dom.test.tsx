// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { FormularioRemover, FormularioVinculo } from './formulario'
import { removerVinculoAcao, salvarVinculoAcao } from './acoes'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
vi.mock('./acoes', () => ({ salvarVinculoAcao: vi.fn(), removerVinculoAcao: vi.fn() }))
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  vi.resetAllMocks()
})
async function montar(remover = false) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(remover ? <FormularioRemover id="vinculo1" nome="Ana" /> : <FormularioVinculo vendedores={[{ id: 'v1', nome: 'Ana' }]} />))
}
async function enviar() {
  const botao = host.querySelector('button')!
  await act(async () => { botao.form!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: botao })) })
}
test('erro preserva vendedor e instância e permite tentar salvar novamente', async () => {
  vi.mocked(salvarVinculoAcao).mockResolvedValueOnce({ erro: 'Instância indisponível.', sucesso: null }).mockResolvedValueOnce({ erro: null, sucesso: 'Vínculo salvo.' })
  await montar()
  const select = host.querySelector('select')!
  const input = host.querySelector<HTMLInputElement>('input[name=instancia]')!
  await act(async () => {
    select.value = 'v1'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'vendas-ana')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(select.value).toBe('v1')
  expect(input.value).toBe('vendas-ana')
  await enviar()
  expect(host.querySelector('[role=alert]')?.textContent).toBe('Instância indisponível.')
  expect(select.value).toBe('v1')
  expect(input.value).toBe('vendas-ana')
  await enviar()
  expect(host.querySelector('[role=status]')?.textContent).toBe('Vínculo salvo.')
  expect(host.querySelector('[role=alert]')).toBeNull()
  expect(vi.mocked(salvarVinculoAcao).mock.calls[1][1].get('instancia')).toBe('vendas-ana')
})
test('remoção envia apenas o vínculo e apresenta falha recuperável', async () => {
  vi.mocked(removerVinculoAcao).mockResolvedValue({ erro: 'Tente novamente.', sucesso: null })
  await montar(true)
  await enviar()
  expect([...vi.mocked(removerVinculoAcao).mock.calls[0][1].entries()]).toEqual([['id', 'vinculo1']])
  expect(host.querySelector('[role=alert]')?.textContent).toBe('Tente novamente.')
  expect(host.querySelector('button')?.disabled).toBe(false)
})
