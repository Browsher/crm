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

test('layout segue a prévia com cinco colunas e critérios junto do nicho',async()=>{
  raiz=createRoot(elemento)
  await act(async()=>raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[]} hoje="2026-10-22"/>))
  expect(elemento.querySelectorAll('thead th')).toHaveLength(5)
  await act(async()=>Array.from(elemento.querySelectorAll('button')).find(b=>b.textContent==='Editar planejamento')!.click())
  expect(elemento.querySelectorAll('tbody td')[0].textContent).toContain('Critérios de busca')
})
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
  expect(elemento.querySelector('[role="note"]')?.getAttribute('data-slot')).toBe('alert')
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

test('critérios usam controles compartilhados e aplicar preserva payload sem liberar dias bloqueados', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-22', '2026-10-23']} planos={[]} hoje="2026-10-22" />))
  await act(async () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Editar planejamento')!.click())
  const abrir = () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Critérios de busca')!.click()
  await act(async () => abrir())
  const dialogo = document.querySelector('[role="dialog"]')!
  expect(dialogo.querySelector('textarea[name="termos"]')?.getAttribute('data-slot')).toBe('textarea')
  expect(dialogo.querySelector('input[value="fixo"]')?.getAttribute('data-slot')).toBe('choice')
  await act(async () => dialogo.querySelector<HTMLInputElement>('input[value="fixo"]')!.click())
  await act(async () => dialogo.querySelector('form')!.requestSubmit())
  const payload = JSON.parse(elemento.querySelector<HTMLInputElement>('input[name="dias"]')!.value)
  expect(payload).toHaveLength(1)
  expect(payload[0]).toMatchObject({ dia: '2026-10-23', criterios: { telefone: ['fixo'], nota: null, termos: '' } })
  await act(async () => abrir())
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[value="fixo"]')!.checked).toBe(true)
})