// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { MenuPainelCrm } from './menu-painel'
import { EstadoPainelCrm } from './estado-painel'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })
function montar() { host = document.createElement('div'); document.body.append(host); root = createRoot(host) }

test('menu usa botões comuns, preserva IDs ao reconstruir e entrega o gatilho para restaurar foco', async () => {
  montar()
  const abrir = vi.fn()
  const itens = [{ id: 'dados-empresa', titulo: 'Dados da empresa', descricao: 'Cadastro salvo', aoAbrir: abrir }, { id: 'historico', titulo: 'Histórico', desabilitado: true, aoAbrir: abrir }] as const
  await act(async () => root.render(<MenuPainelCrm rotulo="Seções da empresa" itens={itens} />))
  const nav = host.querySelector('nav')!
  expect(nav.getAttribute('aria-label')).toBe('Seções da empresa')
  expect(nav.querySelector('[role=menu], [role=tablist], [role=tab], [role=menuitem]')).toBeNull()
  const dados = nav.querySelector<HTMLButtonElement>('#dados-empresa')!
  expect(dados.tabIndex).toBe(0)
  expect(dados.textContent).toContain('Cadastro salvo')
  await act(async () => { dados.focus(); dados.click() })
  expect(abrir).toHaveBeenCalledWith(dados)
  await act(async () => nav.querySelector<HTMLButtonElement>('#historico')!.click())
  expect(abrir).toHaveBeenCalledTimes(1)
  await act(async () => root.render(null))
  await act(async () => root.render(<MenuPainelCrm rotulo="Seções da empresa" itens={itens} />))
  document.getElementById(dados.id)!.focus()
  expect(document.activeElement).toBe(host.querySelector('#dados-empresa'))
})

test.each(['carregando', 'vazio', 'erro', 'indisponivel', 'pendente', 'incerto', 'sucesso'] as const)('estado %s anuncia texto sem fabricar ação', async tipo => {
  montar()
  await act(async () => root.render(<EstadoPainelCrm tipo={tipo} titulo="Estado da tarefa" descricao="Explicação do estado" />))
  const estado = host.querySelector(`[role=${tipo === 'erro' ? 'alert' : 'status'}]`)!
  expect(estado.textContent).toContain('Estado da tarefa')
  expect(estado.textContent).toContain('Explicação do estado')
  expect(estado.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(host.querySelector('button, a')).toBeNull()
})
