// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { FormularioContato } from './formulario'
const gravar = vi.hoisted(() => vi.fn())
vi.mock('./acao', () => ({ registrarContatoAcao: gravar, prepararContatoAcao: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let host: HTMLDivElement, destino: HTMLElement, root: ReturnType<typeof createRoot>
beforeEach(() => { sessionStorage.clear(); gravar.mockReset(); host = document.createElement('div'); destino = document.createElement('footer'); document.body.append(host, destino); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); destino.remove() })
test('ações externas continuam no formulário certo e preservam editor e envio ao ocultar o destino', async () => {
  const cancelar = vi.fn()
  const renderizar = (alvo: HTMLElement | null) => root.render(<FormularioContato empresaId="externa" versao={3} fase="negociacao" onCancel={cancelar} destinoAcoes={alvo} />)
  await act(async () => renderizar(destino))
  const formulario = host.querySelector('form')!
  const submit = destino.querySelector<HTMLButtonElement>('button[type=submit]')!
  expect(submit).not.toBeNull()
  expect(submit.form).toBe(formulario)
  expect(formulario.contains(submit)).toBe(false)
  expect(destino.querySelector('footer')).toBeNull()
  let resolver!: (valor: { ok: false; erro: string }) => void
  gravar.mockReturnValue(new Promise(r => { resolver = r }))
  await act(async () => submit.click())
  const envio = sessionStorage.getItem('crm:contato:v1:externa')
  await act(async () => renderizar(null))
  expect(host.querySelector('form')).toBe(formulario)
  expect(destino.childElementCount).toBe(0)
  await act(async () => renderizar(destino))
  expect(destino.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true)
  await act(async () => destino.querySelector<HTMLButtonElement>('button[type=submit]')!.click())
  expect(gravar).toHaveBeenCalledOnce()
  expect(sessionStorage.getItem('crm:contato:v1:externa')).toBe(envio)
  await act(async () => resolver({ ok: false, erro: 'Sem resposta conclusiva' }))
})
test('sem destinoAcoes mantém rodapé legado e associação nativa de submit', async () => {
  await act(async () => root.render(<FormularioContato empresaId="legada" versao={3} fase="negociacao" />))
  const formulario = host.querySelector('form')!
  expect(formulario.querySelector<HTMLButtonElement>('footer button[type=submit]')?.form).toBe(formulario)
  expect(destino.childElementCount).toBe(0)
})
test('ações de recuperação de recusa conclusiva também ficam no destino externo', async () => {
  gravar.mockResolvedValue({ ok: false, erro: 'Empresa desatualizada', motivo: 'desatualizada' })
  await act(async () => root.render(<FormularioContato empresaId="recuperar" versao={3} fase="negociacao" destinoAcoes={destino} onCancel={vi.fn()} />))
  await act(async () => destino.querySelector<HTMLButtonElement>('button[type=submit]')!.click())
  expect(destino.textContent).toContain('Atualizar atendimento para novo envio')
  expect(host.textContent).toContain('Empresa desatualizada')
  await act(async () => root.render(<FormularioContato empresaId="recuperar" versao={3} fase="negociacao" destinoAcoes={destino} onCancel={vi.fn()} bloqueado />))
  const atualizar = [...destino.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Atualizar atendimento para novo envio')!
  expect(atualizar.disabled).toBe(true)
})
