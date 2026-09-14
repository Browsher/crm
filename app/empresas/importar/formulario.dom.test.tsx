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
const conferido: EstadoImportar = { erro: null, relatorio, inseridas: null, grupoId: null }
const concluido: EstadoImportar = {
  erro: null,
  relatorio,
  inseridas: 2,
  grupoId: '77777777-7777-4777-8777-777777777777',
}
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement

afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  mock.mockReset()
})

async function montar() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<FormularioImportar />))
}

function botao(nome: string) {
  const b = [...host.querySelectorAll('button')].find((botao) => botao.textContent === nome)
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
    if (b.type === 'submit') {
      b.form!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: b }))
    } else {
      b.click()
    }
  })
}

async function preencherNome(valor = 'Mooca') {
  const input = host.querySelector<HTMLInputElement>('input[name=nome]')!
  expect(input).toBeTruthy()
  const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    definir.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return input
}

async function arquivo(nome = 'empresas.csv') {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!
  const file = new File(['csv'], nome, { type: 'text/csv' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
  return { input, file }
}

function chave() {
  return host.querySelector<HTMLInputElement>('input[name=chave]')!.value
}

function dadosDaChamada(indice: number) {
  return mock.mock.calls[indice][1]
}

test('conferir e confirmar usam a mesma chave, nome e arquivo', async () => {
  mock.mockResolvedValueOnce(conferido).mockResolvedValueOnce(concluido)
  await montar()
  await preencherNome()
  const { input, file } = await arquivo()
  const operacao = chave()

  await clicar('Conferir arquivo')
  expect(host.querySelector('[aria-current=step]')?.textContent).toBe('Conferir')
  expect(host.textContent).toContain('Grupo Mooca')
  expect(botao('Confirmar importação')).toBeTruthy()
  expect(input.files?.[0]).toBe(file)
  await clicar('Confirmar importação')

  expect(dadosDaChamada(0).get('chave')).toBe(operacao)
  expect(dadosDaChamada(1).get('chave')).toBe(operacao)
  expect(dadosDaChamada(0).get('nome')).toBe('Mooca')
  expect(dadosDaChamada(1).get('nome')).toBe('Mooca')
  expect(input.files?.[0]).toBe(file)
})

test('voltar mantém o File; mudar nome invalida a conferência e inicia outra operação', async () => {
  mock.mockResolvedValue(conferido)
  await montar()
  await preencherNome()
  const { input, file } = await arquivo()
  const primeira = chave()
  await clicar('Conferir arquivo')
  await clicar('Enviar')

  expect(host.querySelector('input[type=file]')).toBe(input)
  expect(input.files?.[0]).toBe(file)
  expect(host.querySelector('button[name=confirmar]')).toBeNull()

  await preencherNome('Centro')
  expect(chave()).not.toBe(primeira)
  expect(input.files?.[0]).toBe(file)
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
})

test('mudar arquivo invalida a conferência e inicia outra operação', async () => {
  mock.mockResolvedValue(conferido)
  await montar()
  await preencherNome()
  await arquivo()
  const primeira = chave()
  await clicar('Conferir arquivo')
  await arquivo('outra.csv')

  expect(chave()).not.toBe(primeira)
  expect(host.querySelector('button[name=confirmar]')).toBeNull()
})

test('retornos explícitos à etapa Enviar movem o foco para o título', async () => {
  mock.mockResolvedValue(conferido)
  await montar()
  await preencherNome()
  await arquivo()
  await clicar('Conferir arquivo')

  const enviar = botao('Enviar')
  enviar.focus()
  await clicar('Enviar')
  expect(document.activeElement).toBe(tituloEnviar())

  await clicar('Conferir arquivo')
  const voltar = botao('Voltar ao arquivo')
  voltar.focus()
  await clicar('Voltar ao arquivo')
  expect(document.activeElement).toBe(tituloEnviar())
})

test('trocar o arquivo preserva o foco no input', async () => {
  await montar()
  await preencherNome()
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!
  input.focus()
  await arquivo()
  expect(document.activeElement).toBe(input)
})

test('pendente bloqueia troca e navegação, erro descarta confirmação antiga', async () => {
  await montar()
  const nome = await preencherNome()
  const { input, file } = await arquivo()
  const operacao = chave()
  mock.mockResolvedValueOnce(conferido)
  await clicar('Conferir arquivo')
  let resolver!: (r: EstadoImportar) => void
  mock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve }))
  await clicar('Confirmar importação')
  expect(host.querySelector('fieldset')?.disabled).toBe(true)
  expect(host.querySelector('nav button')).toBeNull()
  await act(async () => resolver({ erro: 'Confira novamente.', relatorio: null, inseridas: null, grupoId: null }))
  const alerta = host.querySelector('[role=alert]')
  expect(alerta?.textContent).toBe('Confira novamente.')
  expect(document.activeElement).toBe(alerta)
  expect(nome.value).toBe('Mooca')
  expect(input.files?.[0]).toBe(file)
  expect(chave()).toBe(operacao)
  expect(host.querySelector('button[name=confirmar]')).toBeNull()

  mock.mockResolvedValueOnce(conferido)
  await clicar('Conferir arquivo')
  expect(chave()).toBe(operacao)
  expect(input.files?.[0]).toBe(file)
})

test('somente existentes ainda permite confirmar e mostra o total do grupo', async () => {
  const somenteExistentes = { ...relatorio, novas: 0, jaCadastradas: 3 }
  mock
    .mockResolvedValueOnce({ ...conferido, relatorio: somenteExistentes })
    .mockResolvedValueOnce({ ...concluido, relatorio: somenteExistentes, inseridas: 0 })
  await montar()
  await preencherNome()
  await arquivo()
  await clicar('Conferir arquivo')

  expect(botao('Confirmar importação')).toBeTruthy()
  await clicar('Confirmar importação')
  expect(host.textContent).toContain('0 empresas novas')
  expect(host.textContent).toContain('3 empresas no grupo')
  expect(host.querySelector('a[href="/empresas/grupos/77777777-7777-4777-8777-777777777777"]')).toBeTruthy()
  expect(host.querySelector('a[href="/empresas"]')).toBeTruthy()
})

test('reiniciar limpa nome e arquivo e gera outra chave', async () => {
  mock.mockResolvedValueOnce(conferido).mockResolvedValueOnce(concluido)
  await montar()
  const nome = await preencherNome()
  const { input } = await arquivo()
  const primeira = chave()
  await clicar('Conferir arquivo')
  await clicar('Confirmar importação')
  await clicar('Importar outro arquivo')

  expect(nome.value).toBe('')
  expect(input.value).toBe('')
  expect(chave()).not.toBe(primeira)
  expect(document.activeElement).toBe(tituloEnviar())
})
