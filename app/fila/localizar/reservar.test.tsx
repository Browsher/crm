// @vitest-environment jsdom
import { act, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { rascunhoInicial } from '@/src/features/contato/rascunho'

const mocks = vi.hoisted(() => ({ agir: vi.fn(), push: vi.fn(), tema: vi.fn(() => 'dark' as const) }))
vi.mock('../acoes', () => ({ agirNaFilaAcao: mocks.agir }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('../tema', () => ({ useTemaFila: mocks.tema }))
import { RascunhosProvider, useRascunhos } from '../rascunhos'
import { Reservar } from './reservar'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const filtros = { nome: '', cnae: null, uf: null, cidade: null, bairro: null, pagina: 1 }
const raizes: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const raiz of raizes.splice(0)) await act(async () => raiz.unmount())
  document.body.replaceChildren()
  vi.clearAllMocks()
})

function ComRascunho() {
  const rascunhos = useRascunhos()
  const preparado = useRef(false)
  useEffect(() => {
    if (preparado.current) return
    preparado.current = true
    rascunhos.atualizar('atual', 'Empresa atual', { ...rascunhoInicial(false), nota: 'Ligar amanhã' })
  }, [rascunhos])
  return <><span data-testid="rascunho-atual">{rascunhos.entradas.atual?.valor.nota}</span><Reservar empresaId="nova" contexto={null} filtros={filtros} empresaAtual="atual" /></>
}

test('cancelar troca no diálogo preserva rascunho e não chama a action', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const raiz = createRoot(container)
  raizes.push(raiz)
  await act(async () => raiz.render(<RascunhosProvider><ComRascunho /></RascunhosProvider>))

  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')
  await act(async () => submit?.click())
  expect(document.body.textContent).toContain('Trocar de empresa e descartar as anotações?')
  expect(document.body.querySelector('[data-theme="dark"]')).not.toBeNull()

  const cancelar = [...document.body.querySelectorAll('button')].find(botao => botao.textContent === 'Cancelar')
  await act(async () => cancelar?.click())
  expect(mocks.agir).not.toHaveBeenCalled()
  expect(container.querySelector('[data-testid="rascunho-atual"]')?.textContent).toBe('Ligar amanhã')
})

test('aceitar troca mantém o submitter reservar e chama a action uma vez', async () => {
  mocks.agir.mockResolvedValue({ erro: null, filaVazia: false, resultado: 'ok', empresaId: 'nova' })
  const container = document.createElement('div')
  document.body.append(container)
  const raiz = createRoot(container)
  raizes.push(raiz)
  await act(async () => raiz.render(<RascunhosProvider><ComRascunho /></RascunhosProvider>))

  await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click())
  const aceitar = [...document.body.querySelectorAll('button')].find(botao => botao.textContent === 'Descartar e continuar')
  await act(async () => aceitar?.click())

  expect(mocks.agir).toHaveBeenCalledTimes(1)
  const form = mocks.agir.mock.calls[0]?.[1] as FormData
  expect(form.get('acao')).toBe('reservar')
  expect(form.get('empresaId')).toBe('nova')
})
