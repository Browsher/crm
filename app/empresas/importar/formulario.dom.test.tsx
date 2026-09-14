// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { EstadoImportar } from './acao'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

vi.mock('./acao', () => ({ importarAcao: vi.fn() }))
const { importarAcao } = await import('./acao')
const { FormularioImportar } = await import('./formulario')
const mock = vi.mocked(importarAcao)
const relatorio = { novas: 2, jaCadastradas: 1, recusadas: [], cepsPedidos: 0, cepsNaoEncontrados: 0, basePublicadaEm: null }
const conferido: EstadoImportar = { erro: null, relatorio, inseridas: null }
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); mock.mockReset() })
async function montar() {
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<FormularioImportar />))
}
function botao(nome: string) {
  const b = [...host.querySelectorAll('button')].find(b => b.textContent === nome)
  expect(b, `botão ${nome}`).toBeTruthy()
  return b!
}
function tituloEnviar() {
  const titulo = host.querySelector<HTMLHeadingElement>('h2')
  expect(titulo?.textContent).toBe('Enviar arquivo')
  return titulo!
}
async function clicar(nome: string) {
  await act(async () => {
    const b = botao(nome)
    // JSDOM não possui DataTransfer para popular a seleção nativa. Os testes
    // E2E cobrem validação e envio reais; aqui despachamos o submit válido.
    if (b.type === 'submit') b.form!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: b }))
    else b.click()
  })
}
async function arquivo() {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!
  const file = new File(['csv'], 'empresas.csv', { type: 'text/csv' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  return { input, file }
}
test('conferir e voltar preservam o mesmo input e File, trocar invalida o relatório', async () => {
  mock.mockResolvedValue(conferido)
  await montar()
  const { input, file } = await arquivo()
  await clicar('Conferir arquivo')
  expect(host.querySelector('[aria-current=step]')?.textContent).toBe('Conferir')
  expect(botao('Importar 2 empresas')).toBeTruthy()
  await clicar('Enviar')
  expect(host.querySelector('input[type=file]')).toBe(input)
  expect(input.files?.[0]).toBe(file)
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
  await arquivo()
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
  await clicar('Conferir arquivo')
  expect(mock).toHaveBeenCalledTimes(2)
})
test('retornos explícitos à etapa Enviar movem o foco para o título', async () => {
  mock.mockResolvedValue(conferido)
  await montar()
  await arquivo()
  await clicar('Conferir arquivo')

  const enviar = botao('Enviar')
  enviar.focus()
  expect(document.activeElement).toBe(enviar)
  await clicar('Enviar')
  expect(document.activeElement).toBe(tituloEnviar())

  await clicar('Conferir arquivo')
  const voltar = botao('Voltar ao arquivo')
  voltar.focus()
  expect(document.activeElement).toBe(voltar)
  await clicar('Voltar ao arquivo')
  expect(document.activeElement).toBe(tituloEnviar())

  await clicar('Conferir arquivo')
  mock.mockResolvedValueOnce({ ...conferido, inseridas: 1 })
  await clicar('Importar 2 empresas')
  const reiniciar = botao('Importar outro arquivo')
  reiniciar.focus()
  expect(document.activeElement).toBe(reiniciar)
  await clicar('Importar outro arquivo')
  expect(document.activeElement).toBe(tituloEnviar())
})
test('trocar o arquivo preserva o foco no input', async () => {
  await montar()
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!
  input.focus()
  expect(document.activeElement).toBe(input)
  await arquivo()
  expect(document.activeElement).toBe(input)
})
test('pendente bloqueia troca e navegação, erro descarta confirmação antiga', async () => {
  await montar(); await arquivo()
  mock.mockResolvedValueOnce(conferido)
  await clicar('Conferir arquivo')
  let resolver!: (r: EstadoImportar) => void
  mock.mockReturnValueOnce(new Promise(resolve => { resolver = resolve }))
  await clicar('Importar 2 empresas')
  expect(host.querySelector('fieldset')?.disabled).toBe(true)
  expect(host.querySelector('nav button')).toBeNull()
  await act(async () => resolver({ erro: 'Confira novamente.', relatorio: null, inseridas: null }))
  expect(host.querySelector('[role=alert]')?.textContent).toBe('Confira novamente.')
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
})
test('zero novas não confirma; conclusão usa número real e não volta à gravação', async () => {
  await montar(); await arquivo()
  mock.mockResolvedValueOnce({ ...conferido, relatorio: { ...relatorio, novas: 0 } })
  await clicar('Conferir arquivo')
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
  await clicar('Enviar')
  mock.mockResolvedValueOnce(conferido)
  await clicar('Conferir arquivo')
  mock.mockResolvedValueOnce({ ...conferido, inseridas: 1 })
  await clicar('Importar 2 empresas')
  expect(host.textContent).toContain('1 empresa importada')
  expect(host.querySelector('nav button')).toBeNull()
  expect(host.querySelector('a[href="/empresas"]')).toBeTruthy()
  await clicar('Importar outro arquivo')
  expect(host.querySelector('[aria-current=step]')?.textContent).toBe('Enviar')
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
})
