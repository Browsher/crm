// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PlanejamentoSemanal } from './planejamento'
import type { PlanoGoogle } from '@/src/features/google/tipos'

vi.mock('./acoes', () => ({ salvarSemanaAcao: async () => ({ erro: null, salvo: true }), copiarPlanoAcao: async () => ({ erro: null, salvo: true }), sincronizarPlanoAcao: async () => ({ erro: null }) }))
const elemento = document.createElement('div')
document.body.append(elemento)
let raiz: ReturnType<typeof createRoot> | undefined
afterEach(async () => { await act(async () => raiz?.unmount()); elemento.replaceChildren() })
test('tabela destaca hoje e edição só habilita datas futuras', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']} planos={[]} hoje="2026-10-22" rotinaIniciada={false} />))
  await act(async () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Editar planejamento')!.click())
  const linhas = elemento.querySelectorAll('tbody tr')
  expect(linhas).toHaveLength(5)
  expect(linhas[3].textContent).toContain('Hoje')
  expect(linhas[3].querySelector('input')).toBeNull()
  expect(linhas[4].querySelectorAll('input').length).toBeGreaterThan(0)
  expect(linhas[4].querySelector('input')?.required).toBe(false)
})
test('hoje sem plano continua não definido e bloqueado', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-22']} planos={[]} hoje="2026-10-22" rotinaIniciada />))
  expect(elemento.textContent).toContain('Não definido')
  expect(elemento.querySelector('input:not([type="hidden"])')).toBeNull()
})

test('pendência de sincronização permite conferir novamente fora do formulário da semana', async () => {
  raiz = createRoot(elemento)
  const plano = { id: 'pendente', dia: '2026-10-23', nicho: 'Lojas', cidade: 'São Paulo', uf: 'SP', bairro: '', sincronizado: false, sincronizacao_erro: 'Resposta não confirmada' } as PlanoGoogle
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[plano]} hoje="2026-10-22" />))
  expect(Array.from(elemento.querySelectorAll('button')).some(b => b.textContent === 'Sincronizar novamente')).toBe(true)
  expect(elemento.querySelector('form form')).toBeNull()
})
test('critérios abrem em diálogo e cancelar não altera rascunho da semana', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[]} hoje="2026-10-22" rotinaIniciada={false} />))
  await act(async () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Editar planejamento')!.click())
  const botao = Array.from(elemento.querySelectorAll('button')).find(b => b.textContent?.includes('Critérios de busca'))!
  await act(async () => botao.click())
  const dialogo = document.querySelector('[role="dialog"]')!
  expect(dialogo.textContent).toContain('Contatos e presença digital')
  expect(dialogo.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(5)
  await act(async () => dialogo.querySelector<HTMLInputElement>('input[value="fixo"]')!.click())
  await act(async () => Array.from(dialogo.querySelectorAll('button')).find(b => b.textContent === 'Cancelar')!.click())
  await act(async () => botao.click())
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[value="fixo"]')?.checked).toBe(false)
})
