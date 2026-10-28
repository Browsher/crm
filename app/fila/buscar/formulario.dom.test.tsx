// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { FormularioBusca } from './formulario'
vi.mock('./acoes', () => ({ buscarEmpresasAcao: vi.fn() }))
let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => { if (raiz) await act(async () => raiz!.unmount()); host?.remove(); vi.unstubAllGlobals() })
test('nova busca confirmada recebe outro UUID e atualização da mesma tentativa preserva sua identidade', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  const primeira = '11111111-1111-4111-8111-111111111111'
  const segunda = '22222222-2222-4222-8222-222222222222'
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={10} chaveInicial={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(primeira)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial={segunda} buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial="33333333-3333-4333-8333-333333333333" buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
})


test('escolhas, exclusões e UUID persistem quando os seis filtros são recolhidos', async () => {
  host = document.createElement('div'); document.body.append(host); raiz = createRoot(host)
  const chave = '11111111-1111-4111-8111-111111111111'
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={100} chaveInicial={chave} />))
  const botao = (titulo: string) => [...host!.querySelectorAll('h2 button')].find(b => b.querySelector('strong')?.textContent === titulo) as HTMLButtonElement
  const escolha = (texto: string) => [...host!.querySelectorAll('label')].find(l => l.textContent === texto)!.querySelector<HTMLInputElement>('input')!
  await act(async () => botao('Perfil da empresa').click())
  await act(async () => escolha('Excluir optantes do MEI').click())
  expect(escolha('MEI').disabled).toBe(true)
  await act(async () => botao('Perfil da empresa').click())
  await act(async () => botao('Perfil da empresa').click())
  expect(escolha('Excluir optantes do MEI').checked).toBe(true)
  await act(async () => botao('Contatos e qualidade').click())
  await act(async () => escolha('Evitar emails de contabilidade').click())
  await act(async () => botao('Contatos e qualidade').click())
  const form = host.querySelector('form')!
  const dados = new FormData(form)
  const filtros = JSON.parse(String(dados.get('avancados')))
  expect(dados.get('chave')).toBe(chave)
  expect(filtros.excluirMei).toBe(true)
  expect(filtros.semEmailContabil).toBe(true)
  expect(host.querySelectorAll('h2 button')).toHaveLength(6)
  expect(form.querySelectorAll('form')).toHaveLength(0)
})
