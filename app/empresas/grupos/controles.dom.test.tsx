// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ControlesGrupo } from './controles'
import { alterarGrupoAcao } from './acoes'
vi.mock('./acoes', () => ({ alterarGrupoAcao: vi.fn() }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  host?.remove()
  vi.resetAllMocks()
})
async function montar(ativo = true) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<ControlesGrupo id="grupo" nome="Centro" ativo={ativo} impactoDesativacao={8} />))
}
function botao(texto: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === texto)!
}
async function clicar(texto: string) {
  await act(async () => botao(texto).click())
  // FocusScope restaura o gatilho num timer após desmontar o portal.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

test('desativação abre confirmação com retrato atual, cancelamento e Escape restauram foco', async () => {
  await montar()
  const gatilho = botao('Desativar grupo')
  gatilho.focus()
  await clicar('Desativar grupo')
  const dialogo = document.querySelector('[role=dialog]')!
  expect(dialogo.getAttribute('data-slot')).toBe('dialog-content')
  expect(dialogo.textContent).toContain('8 empresas disponíveis neste grupo')
  expect(dialogo.textContent).toContain('retrato atual')
  expect(dialogo.textContent).toContain('vínculos com vendedores')
  expect(document.activeElement).toBe(botao('Cancelar'))
  const fechar = document.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')!
  fechar.focus()
  await act(async () => fechar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(botao('Cancelar'))
  await act(async () => botao('Cancelar').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(fechar)
  await clicar('Cancelar')
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(document.activeElement).toBe(gatilho)
  await clicar('Desativar grupo')
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(document.activeElement).toBe(gatilho)
  expect(alterarGrupoAcao).not.toHaveBeenCalled()
})

test('erro fica no diálogo com nome editado e permite tentar de novo; sucesso fecha', async () => {
  await montar()
  await clicar('Renomear')
  const painel = document.querySelector('[role=dialog][data-painel-lateral]')!
  expect(painel).not.toBeNull()
  const input = document.querySelector<HTMLInputElement>('input[name=nome]')!
  expect(painel.querySelector<HTMLButtonElement>('[data-painel-rodape] button[type=submit]')?.form).toBe(input.form)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Novo nome')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  vi.mocked(alterarGrupoAcao).mockResolvedValueOnce({ erro: 'Sem permissão.', sucesso: false }).mockResolvedValueOnce({ erro: null, sucesso: true })
  await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(document.querySelector('[role=alert]')?.textContent).toContain('Sem permissão')
  expect(document.querySelector('[role=alert]')?.getAttribute('data-slot')).toBe('alert')
  expect(input.value).toBe('Novo nome')
  expect(document.querySelector('[role=dialog]')?.contains(document.activeElement)).toBe(true)
  await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.querySelector('[role=dialog]')).toBeNull()
  expect(document.activeElement).toBe(botao('Renomear'))
})

test('aviso de reativação concluída muda da confirmação para o recibo lateral', async () => {
  await montar(false)
  vi.mocked(alterarGrupoAcao).mockResolvedValueOnce({ erro: null, sucesso: true, aviso: 'Gravado. Atualize a lista.' })
  await clicar('Reativar grupo')
  await clicar('Confirmar')
  const recibo = document.querySelector('[role=dialog][data-painel-lateral]')!
  expect(recibo).not.toBeNull()
  expect(recibo.contains(document.activeElement)).toBe(true)
  expect(recibo.querySelector('[role=status]')?.textContent).toContain('Gravado')
  expect(recibo.querySelector('form')).toBeNull()
  await clicar('Concluir')
  expect(document.activeElement).toBe(botao('Reativar grupo'))
  expect(alterarGrupoAcao).toHaveBeenCalledTimes(1)
})

test('resposta incerta ao renomear mantém o nome editado e impede outro envio', async () => {
  await montar()
  await clicar('Renomear')
  const input = document.querySelector<HTMLInputElement>('input[name=nome]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Nome incerto')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  vi.mocked(alterarGrupoAcao).mockRejectedValueOnce(new Error('Resposta perdida'))
  await clicar('Salvar nome')
  expect(input.value).toBe('Nome incerto')
  expect(document.querySelector('[role=alert]')?.textContent).toContain('confira o estado')
  expect(botao('Salvar nome').disabled).toBe(true)
  await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(alterarGrupoAcao).toHaveBeenCalledTimes(1)
})

test('pendente impede duplo envio e fecha só após resultado; reativar envia ação correta', async () => {
  await montar(false)
  let concluir!: (r: { erro: null; sucesso: true }) => void
  vi.mocked(alterarGrupoAcao).mockReturnValue(new Promise(resolve => { concluir = resolve }))
  await clicar('Reativar grupo')
  const form = document.querySelector('form')!
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(botao('Salvando…').disabled).toBe(true)
  expect(botao('Cancelar').disabled).toBe(true)
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(alterarGrupoAcao).toHaveBeenCalledTimes(1)
  await act(async () => document.querySelector('[role=dialog]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(document.querySelector('[role=dialog]')).not.toBeNull()
  expect(vi.mocked(alterarGrupoAcao).mock.calls[0][1].get('acao')).toBe('reativar')
  await act(async () => concluir({ erro: null, sucesso: true }))
  expect(document.querySelector('[role=dialog]')).toBeNull()
})
