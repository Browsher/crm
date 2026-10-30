// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ShellCrm } from '@/src/components/crm/shell'
import { TemaCrmProvider } from '@/src/components/crm/tema'
import { Galeria } from './galeria'

vi.mock('next/navigation', () => ({ usePathname: () => '/design' }))

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<TemaCrmProvider><ShellCrm nome="Ana" papel="gestor" area="design"><Galeria /></ShellCrm></TemaCrmProvider>))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function botao(texto: string) {
  const elemento = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === texto)
  if (!elemento) throw new Error(`Botao nao encontrado: ${texto}`)
  return elemento
}

test('abas da ficha mostram dados e histórico sem misturar o conteúdo', async () => {
  const abas = container.querySelectorAll<HTMLButtonElement>('[role=tab]')
  expect(abas.length).toBe(2)
  expect(container.querySelector('[role=tabpanel]')?.textContent).toContain('Contato principal')
  await act(async () => abas[1].click())
  expect(document.getElementById(abas[1].getAttribute('aria-controls')!)?.textContent).toContain('Ligação de demonstração')
})

test('expõe as seções e dados fictícios da referência', () => {
  expect(container.textContent).toContain('Dados fictícios')
  expect(container.textContent).toContain('Tipografia')
  expect(container.textContent).toContain('Botões')
  expect(container.textContent).toContain('Nome da empresa')
  expect(container.textContent).toContain('CNAE')
  expect(container.textContent).toContain('Estado')
  expect(container.textContent).toContain('Cidade')
  expect(container.textContent).toContain('Bairro')
  expect(container.textContent).toContain('Cliente')
  expect(container.textContent).toContain('A contatar')
  expect(container.textContent).toContain('Indisponível')
  expect(container.textContent).toContain('Com outro vendedor')
  expect(container.textContent).not.toContain('Reserva expirada')
  expect(container.textContent).not.toContain('Nenhuma empresa encontrada')
  expect(container.querySelector('#cnae')?.tagName).toBe('SELECT')
  expect(container.querySelector('[aria-invalid="true"]')?.getAttribute('aria-describedby')).toBe('telefone-erro')
  expect(container.querySelector<HTMLInputElement>('#codigo-empresa')?.readOnly).toBe(true)
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

test('usa o card real com detalhe cadastral local e ausências explícitas', async () => {
  const card = [...container.querySelectorAll('[data-testid="company-list"] > *')]
    .find((item) => item.textContent?.includes('Café Cedro'))
  const abrir = [...(card?.querySelectorAll('button') ?? [])].find((item) => item.textContent === 'Ver empresa')

  await act(async () => abrir?.click())

  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Telefone principal')
  expect(card?.textContent).not.toContain('Ausente')
  expect(card?.textContent).toContain('AtividadeNão informado')
})

test('o descarte real fica fora das três etapas e responde à simulação', async () => {
  expect(container.querySelectorAll('[data-etapa-funil]')).toHaveLength(3)
  expect(container.querySelectorAll('[data-descarte]')).toHaveLength(1)
  expect(container.querySelector('[data-etapa-funil] [data-descarte]')).toBeNull()
  await act(async()=>botao('Simular arquivamento').click())
  expect(container.querySelector('[data-descarte]')?.getAttribute('data-estado')).toBe('sucesso')
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
  const seletor = container.querySelector<HTMLSelectElement>('[aria-label="Tema do design system"]')

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


test('galeria usa somente um shell e mostra tabela com componentes reais', () => {
  expect(container.querySelectorAll('nav[aria-label="Navegação do CRM"]')).toHaveLength(1)
  expect(container.querySelectorAll('nav[aria-label="Seções da galeria"]')).toHaveLength(1)
  expect(container.querySelectorAll('select[aria-label^="Tema"]')).toHaveLength(1)
  const tabela = container.querySelector('table[aria-label="Empresas de demonstração"]')
  expect(tabela?.querySelectorAll('tbody tr')).toHaveLength(3)
  expect(tabela?.querySelector('th[scope="col"]')?.textContent).toBe('Empresa')
})

test('galeria compartilha shell e tema sem perder rascunho na ficha', async () => {
  const nota = container.querySelector<HTMLTextAreaElement>('[aria-label="Nota da ficha"]')!
  expect(nota).not.toBeNull()
  await act(async () => {
    nota.value = 'Rascunho preservado entre abas'
    nota.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const abas = container.querySelectorAll<HTMLButtonElement>('[role=tab]')
  await act(async () => abas[1].click())
  expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Nota da ficha"]')?.value).toBe('Rascunho preservado entre abas')
  const seletor = container.querySelector<HTMLSelectElement>('[aria-label="Tema do design system"]')!
  await act(async () => {
    seletor.value = 'dark'
    seletor.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => botao('Próxima').click())
  expect(document.querySelector('.ui-dialog-portal')?.getAttribute('data-theme')).toBe('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
})
