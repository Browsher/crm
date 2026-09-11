// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Galeria } from './galeria'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Galeria />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function botao(texto: string) {
  const elemento = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === texto)
  if (!elemento) throw new Error(`Botao nao encontrado: ${texto}`)
  return elemento
}

test('expõe as seções e dados fictícios da referência', () => {
  expect(container.textContent).toContain('Dados fictícios')
  expect(container.textContent).toContain('Tipografia')
  expect(container.textContent).toContain('Botões')
  expect(container.textContent).toContain('Nome da empresa')
  expect(container.textContent).toContain('CNAE')
  expect(container.textContent).toContain('Estado')
  expect(container.textContent).toContain('Cidade')
  expect(container.textContent).toContain('Bairro')
  expect(container.textContent).toContain('Disponível')
  expect(container.textContent).toContain('Reservada para você')
  expect(container.textContent).toContain('Indisponível')
  expect(container.textContent).toContain('Com outro vendedor')
  expect(container.textContent).toContain('Reserva expirada')
  expect(container.textContent).not.toContain('Nenhuma empresa encontrada')
  expect(container.querySelector('#cnae')?.tagName).toBe('SELECT')
  expect(container.querySelector('[aria-invalid="true"]')?.getAttribute('aria-describedby')).toBe('telefone-erro')
  expect(container.querySelector<HTMLInputElement>('#codigo-reserva')?.readOnly).toBe(true)
  expect(container.querySelector<HTMLTextAreaElement>('#anotacoes-expiradas')?.disabled).toBe(false)
})

test('aplica os filtros aos dados fictícios e limpar restaura a lista', async () => {
  const nome = container.querySelector<HTMLInputElement>('#nome')
  await act(async () => {
    if (!nome) throw new Error('Filtro de nome ausente')
    nome.value = 'empresa inexistente'
    nome.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => botao('Aplicar filtros').click())
  expect(container.textContent).toContain('Nenhuma empresa encontrada')
  expect(container.querySelector('#filtros [role="status"]')?.textContent).toContain('Filtros aplicados')
  expect(container.querySelector('[data-testid="company-list"]')?.textContent).not.toContain('Aurora Papelaria Ltda.')

  await act(async () => botao('Limpar filtros').click())
  expect(container.querySelector('[data-testid="company-list"]')?.textContent).toContain('Aurora Papelaria Ltda.')
})

test('abre o exemplo no próprio card sem o rótulo Ausente', async () => {
  const card = [...container.querySelectorAll('[data-testid="company-list"] > *')]
    .find((item) => item.textContent?.includes('Café Cedro'))
  const abrir = [...(card?.querySelectorAll('button') ?? [])].find((item) => item.textContent === 'Ver exemplo')

  await act(async () => abrir?.click())

  expect(card?.textContent).toContain('Telefone fictício')
  expect(card?.textContent).not.toContain('Ausente')
  expect(card?.textContent).toContain('Fechar exemplo')
})

test('registra a confirmação junto à seção do diálogo', async () => {
  await act(async () => botao('Próxima').click())
  expect(document.body.textContent).toContain('Trocar de empresa e descartar as anotações?')
  const confirmar = [...document.body.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Descartar e continuar')
  await act(async () => confirmar?.click())

  expect(container.querySelector('#dialogo [role="status"]')?.textContent).toContain('empresa de exemplo')
})

test('carregamento aparece na busca e termina com o resultado', async () => {
  await act(async () => botao('Simular busca').click())
  expect(botao('Simular busca').disabled).toBe(true)
  expect(container.querySelector('#avisos')?.textContent).toContain('Buscando empresas')
  await act(async () => vi.advanceTimersByTimeAsync(900))
  expect(botao('Simular busca').disabled).toBe(false)
  expect(container.querySelector('#avisos')?.textContent).toContain('1 empresa encontrada')
})

test('falha ao salvar preserva a nota e permite tentar novamente', async () => {
  await act(async () => botao('Simular falha ao salvar').click())
  expect(container.querySelector('#avisos')?.textContent).toContain('Não foi possível salvar')
  expect(container.querySelector<HTMLTextAreaElement>('#nota-salvamento')?.value).toContain('Enviar proposta')
  await act(async () => botao('Tentar salvar novamente').click())
  expect(container.querySelector('#avisos')?.textContent).toContain('Salvando resultado')
  await act(async () => vi.advanceTimersByTimeAsync(900))
  expect(container.querySelector('#avisos')?.textContent).toContain('Resultado salvo na demonstração')
})

test('troca o tema no escopo da galeria', async () => {
  const escopo = container.querySelector('.crm-ui')
  const seletor = container.querySelector<HTMLSelectElement>('[aria-label="Tema da galeria"]')

  expect(escopo?.getAttribute('data-theme')).toBe('system')
  await act(async () => {
    if (!seletor) throw new Error('Seletor de tema ausente')
    seletor.value = 'dark'
    seletor.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(escopo?.getAttribute('data-theme')).toBe('dark')
})

test('simula busca com carregamento e resposta explícita', async () => {
  await act(async () => botao('Buscar cliente').click())
  expect(botao('Buscar cliente').hasAttribute('disabled')).toBe(true)
  expect(botao('Buscar cliente').getAttribute('aria-busy')).toBe('true')

  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(container.querySelector('[role="status"]')?.textContent).toContain('Cliente encontrado')
})

test('avança apenas pelas ações e preserva anotações ao voltar', async () => {
  expect(container.textContent).toContain('Etapa atual: Puxar')
  expect(botao('Voltar').hasAttribute('disabled')).toBe(true)

  await act(async () => botao('Buscar cliente').click())
  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(container.textContent).toContain('Etapa atual: Consultar')

  const nota = container.querySelector<HTMLTextAreaElement>('[aria-label="Anotações da ligação"]')
  await act(async () => {
    if (!nota) throw new Error('Campo de anotacoes ausente')
    nota.value = 'Retornar na sexta pela manhã'
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => botao('Registrar resultado').click())
  expect(container.textContent).toContain('Etapa atual: Registrar')

  await act(async () => botao('Voltar').click())
  expect(container.textContent).toContain('Etapa atual: Consultar')
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Anotações da ligação"]')?.value)
    .toBe('Retornar na sexta pela manhã')
})
