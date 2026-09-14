// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
const { Formulario } = await import('./formulario')

let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  push.mockReset()
})

async function montar() {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Formulario consulta={{
    termo: 'luz', padrao: 'luz', cnpjPrefixo: null, pagina: 2,
    cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Mooca',
  }} opcoes={[
    { tipo: 'cnae', valor: '4742300', rotulo: '4742300' },
    { tipo: 'uf', valor: 'SP', rotulo: 'SP' },
    { tipo: 'uf', valor: 'MG', rotulo: 'MG' },
    { tipo: 'cidade', valor: '3550308', rotulo: 'São Paulo' },
    { tipo: 'bairro', valor: 'Mooca', rotulo: 'Mooca' },
  ]} />))
}

function consultaVazia() {
  return {
    termo: '', padrao: '', cnpjPrefixo: null, pagina: 1,
    cnae: null, uf: null, cidade: null, bairro: null,
  }
}

test('trocar estado limpa cidade e bairro, preserva busca e CNAE e reinicia página', async () => {
  await montar()
  const estado = host.querySelector<HTMLSelectElement>('select[name=uf]')!
  await act(async () => {
    estado.value = 'MG'
    estado.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(push).toHaveBeenCalledOnce()
  const params = new URL(push.mock.calls[0][0], 'http://localhost').searchParams
  expect(Object.fromEntries(params)).toEqual({ q: 'luz', cnae: '4742300', uf: 'MG' })
})

test('nova busca conserva os selects e não carrega a página antiga', async () => {
  await montar()
  const busca = host.querySelector<HTMLInputElement>('input[name=q]')!
  busca.value = 'lâmpadas'
  await act(async () => {
    busca.form!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
  })
  const params = new URL(push.mock.calls[0][0], 'http://localhost').searchParams
  expect(Object.fromEntries(params)).toEqual({
    q: 'lâmpadas', cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Mooca',
  })
  expect(params.has('pagina')).toBe(false)
})

test('novas props depois de navegação reiniciam os controles', async () => {
  await montar()
  await act(async () => root.render(<Formulario consulta={consultaVazia()} opcoes={[]} />))
  expect(host.querySelector<HTMLInputElement>('input[name=q]')?.value).toBe('')
  expect(host.querySelector<HTMLSelectElement>('select[name=uf]')?.value).toBe('')
  expect(host.querySelector<HTMLSelectElement>('select[name=cidade]')?.disabled).toBe(true)
  expect(host.querySelector<HTMLSelectElement>('select[name=bairro]')?.disabled).toBe(true)
})

test('mudar somente a página descarta edições locais ainda não submetidas', async () => {
  await montar()
  const busca = host.querySelector<HTMLInputElement>('input[name=q]')!
  const cnae = host.querySelector<HTMLSelectElement>('select[name=cnae]')!
  const bairro = host.querySelector<HTMLSelectElement>('select[name=bairro]')!
  busca.value = 'rascunho local'
  cnae.value = ''
  bairro.value = ''

  await act(async () => root.render(<Formulario consulta={{
    termo: 'luz', padrao: 'luz', cnpjPrefixo: null, pagina: 3,
    cnae: '4742300', uf: 'SP', cidade: '3550308', bairro: 'Mooca',
  }} opcoes={[]} />))

  expect(host.querySelector<HTMLInputElement>('input[name=q]')?.value).toBe('luz')
  expect(host.querySelector<HTMLSelectElement>('select[name=cnae]')?.value).toBe('4742300')
  expect(host.querySelector<HTMLSelectElement>('select[name=bairro]')?.value).toBe('Mooca')
})

test('limpar na própria URL reseta controles sem alterar clique modificado do link', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Formulario consulta={consultaVazia()} opcoes={[
    { tipo: 'cnae', valor: '4742300', rotulo: '4742300' },
  ]} />))
  const busca = host.querySelector<HTMLInputElement>('input[name=q]')!
  const cnae = host.querySelector<HTMLSelectElement>('select[name=cnae]')!
  const limpar = host.querySelector<HTMLAnchorElement>('a[href="/empresas"]')!
  limpar.addEventListener('click', evento => evento.preventDefault())

  busca.value = 'rascunho local'
  cnae.value = '4742300'
  await act(async () => limpar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
  expect(busca.value).toBe('')
  expect(cnae.value).toBe('')

  busca.value = 'preservar para nova aba'
  await act(async () => limpar.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, button: 0, ctrlKey: true,
  })))
  expect(busca.value).toBe('preservar para nova aba')
})
