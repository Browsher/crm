// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Search } from 'lucide-react'
import { EstadoVazio } from './estado-vazio'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

test('estado vazio usa card e ação semântica sem elementos interativos aninhados', async () => {
  await act(async () => root.render(<EstadoVazio titulo="Sua carteira está vazia" descricao="Assuma uma empresa da fila para começar." acao={{ rotulo: 'Puxar a próxima empresa', href: '/fila' }} />))
  const link = host.querySelector('a[href="/fila"]')
  expect(link?.getAttribute('data-slot')).toBe('button')
  expect(link?.closest('[data-slot="card-footer"]')).not.toBeNull()
  expect(link?.closest('[data-slot="card"]')).not.toBeNull()
  expect(link?.textContent).toBe('Puxar a próxima empresa')
  expect(host.querySelector('a button, button a')).toBeNull()
  expect(host.querySelector('h2')?.textContent).toBe('Sua carteira está vazia')
})

test('ação local aciona uma vez sem submeter formulário e respeita desabilitada', async () => {
  let chamadas = 0
  let envios = 0
  const renderizar = (desabilitada = false) => <form onSubmit={evento => { evento.preventDefault(); envios++ }}><EstadoVazio titulo="Sem resultado" descricao="Limpe os filtros." nivelTitulo={3} icone={Search} acao={{ rotulo: 'Limpar filtros', aoAcionar: () => { chamadas++ }, variante: 'outline', desabilitada }} /></form>
  await act(async () => root.render(renderizar()))
  const botao = host.querySelector('button')!
  expect(host.querySelector('h3')?.textContent).toBe('Sem resultado')
  expect(host.querySelector('h2, a')).toBeNull()
  await act(async () => botao.click())
  expect(chamadas).toBe(1)
  expect(envios).toBe(0)
  await act(async () => root.render(renderizar(true)))
  expect(botao.disabled).toBe(true)
  await act(async () => botao.click())
  expect(chamadas).toBe(1)
})

test('sem ação conserva texto longo completo e dispensa rodapé vazio', async () => {
  const descricao = 'Uma explicação completa para orientar o próximo passo. '.repeat(20)
  await act(async () => root.render(<EstadoVazio titulo="Ainda não há registros" descricao={descricao} />))
  expect(host.querySelector('[data-slot="card"]')).not.toBeNull()
  expect(host.querySelector('[data-slot="card-description"]')?.textContent).toBe(descricao)
  expect(host.querySelector('a, button, [data-slot="card-footer"]')).toBeNull()
  expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})
