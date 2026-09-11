// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
const registrar = vi.hoisted(() => vi.fn())
vi.mock('./registrar-visita-acao', () => ({ registrarVisitaAcao: registrar }))
import { RegistrarVisita } from './registrar-visita'

test('mount registra uma vez, revalidação não repete e falha mantém aviso', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  registrar.mockResolvedValue({ erro: null })
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<RegistrarVisita empresaId="primeira" />))
    await act(async () => root.render(<RegistrarVisita empresaId="primeira" />))
    expect(registrar).toHaveBeenCalledTimes(1)
    registrar.mockRejectedValue(new Error('conexão indisponível'))
    await act(async () => root.render(<RegistrarVisita empresaId="segunda" />))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível atualizar')
    expect(registrar).toHaveBeenCalledTimes(2)
  } finally {
    await act(async () => root.unmount())
  }
})

test('resposta atrasada da empresa anterior não apaga aviso da empresa atual', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let concluirPrimeira!: (r: { erro: string | null }) => void
  registrar.mockReset()
  registrar.mockImplementationOnce(() => new Promise(resolve => { concluirPrimeira = resolve }))
  registrar.mockResolvedValueOnce({ erro: 'Falha na empresa atual' })
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<RegistrarVisita empresaId="primeira" />))
    await act(async () => root.render(<RegistrarVisita empresaId="segunda" />))
    expect(container.textContent).toContain('Falha na empresa atual')
    await act(async () => concluirPrimeira({ erro: null }))
    expect(container.textContent).toContain('Falha na empresa atual')
  } finally {
    await act(async () => root.unmount())
  }
})
