// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { Formulario } from './formulario'
import { Formulario as Troca } from '../trocar-senha/formulario'
import { entrarAcao } from './acao'
import { trocarSenhaAcao } from '../trocar-senha/acao'

vi.mock('./acao', () => ({ entrarAcao: vi.fn() }))
vi.mock('../trocar-senha/acao', () => ({ trocarSenhaAcao: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.resetAllMocks() })
async function montar(troca = false) { host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(troca ? <Troca /> : <Formulario />)) }

test('erro no login mantém e-mail preenchido e editável', async () => {
  vi.mocked(entrarAcao).mockResolvedValue({ erro: 'E-mail ou senha não conferem.' })
  await montar()
  const email = host.querySelector<HTMLInputElement>('input[name=email]')!
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(email, 'ana@teste.local'); email.dispatchEvent(new Event('input', { bubbles: true })) })
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(host.querySelector('[role=alert]')?.textContent).toContain('não conferem')
  expect(email.value).toBe('ana@teste.local')
  expect(email.disabled).toBe(false)
})

test.each([false, true])('envio pendente impede duplicata na autenticação (troca=%s)', async troca => {
  let resolver!: (resultado: { erro: string }) => void
  const acao = troca ? trocarSenhaAcao : entrarAcao
  vi.mocked(acao).mockReturnValue(new Promise(resolve => { resolver = resolve }))
  await montar(troca)
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  const enviar = host.querySelector('button')!
  expect(enviar.disabled).toBe(true)
  await act(async () => enviar.click())
  expect(acao).toHaveBeenCalledTimes(1)
  await act(async () => resolver({ erro: 'Tente novamente.' }))
  expect(enviar.disabled).toBe(false)
})

test.each([false, true])('formulário comunica pendência e associa o erro de autenticação (troca=%s)', async troca => {
  let resolver!: (resultado: { erro: string }) => void
  vi.mocked(troca ? trocarSenhaAcao : entrarAcao).mockReturnValue(new Promise(resolve => { resolver = resolve }))
  await montar(troca)
  const form = host.querySelector('form')!
  expect(form.getAttribute('aria-busy')).toBe('false')
  const senha = host.querySelector<HTMLInputElement>('input[type=password]')!
  expect(senha.autocomplete).toBe('current-password')
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(form.getAttribute('aria-busy')).toBe('true')
  await act(async () => resolver({ erro: 'Tente novamente.' }))
  expect(form.getAttribute('aria-busy')).toBe('false')
  const erro = host.querySelector('[role=alert]')!
  expect(erro.id).not.toBe('')
  expect(form.getAttribute('aria-describedby')).toBe(erro.id)
})
