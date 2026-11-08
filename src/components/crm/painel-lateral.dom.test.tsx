// @vitest-environment jsdom
import { act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PainelLateralCrm } from './painel-lateral'
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot> | undefined
let host: HTMLDivElement | undefined

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  vi.unstubAllGlobals()
})

function simularLargura(inicial: number) {
  let largura = inicial
  const mudancas = new Set<(evento: MediaQueryListEvent) => void>()
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() { return largura <= 820 },
    addEventListener: (_: string, listener: (evento: MediaQueryListEvent) => void) => mudancas.add(listener),
    removeEventListener: (_: string, listener: (evento: MediaQueryListEvent) => void) => mudancas.delete(listener),
  }))
  return async (nova: number) => {
    largura = nova
    await act(async () => mudancas.forEach(listener => listener({ matches: largura <= 820 } as MediaQueryListEvent)))
  }
}

test('rodapé comum fica fora do corpo', async () => {
  simularLargura(821)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<>
    <button>Quadro</button>
    <PainelLateralCrm titulo="Editor" aoFechar={fechar} ocupado rodape={<button>Salvar</button>}>
      {Array.from({ length: 100 }, (_, i) => <p key={i}>Conteúdo {i}</p>)}
    </PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside')!
  const salvar = Array.from(painel.querySelectorAll('button')).find(botao => botao.textContent === 'Salvar')!
  const corpo = painel.querySelector('[data-painel-corpo]')!
  expect(painel.getAttribute('data-painel-composicao')).toBe('padrao')
  expect(corpo?.contains(salvar)).toBe(false)
  expect(painel.querySelector('[data-painel-rodape]')?.contains(salvar)).toBe(true)
  expect(corpo.getAttribute('aria-busy')).toBe('true')
  expect(painel.getAttribute('aria-modal')).toBeNull()
  await act(async () => host?.querySelector('button')?.focus())
  expect(document.activeElement).toBe(host.querySelector('button'))
  await act(async () => painel.querySelector('h2')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).toHaveBeenCalledOnce()
})

test('modo móvel muda sem remontar editor', async () => {
  const largura = simularLargura(821)
  let montagensDoEditor = 0
  function Editor() {
    const [texto, definirTexto] = useState('Rascunho')
    useEffect(() => { montagensDoEditor++ }, [])
    return <button onClick={() => definirTexto('Alterado')}>{texto}</button>
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(<>
    <button data-fundo>Quadro</button>
    <PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={null}><Editor /></PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside')!
  const editor = painel.querySelector('[data-painel-corpo] button') as HTMLButtonElement
  await act(async () => { editor?.focus(); editor?.click() })
  await largura(820)
  expect(host.querySelector('[data-fundo]')?.hasAttribute('inert')).toBe(true)
  expect(painel.getAttribute('aria-modal')).toBe('true')
  expect(document.activeElement).toBe(editor)
  await largura(821)
  expect(painel.getAttribute('aria-modal')).toBeNull()
  expect(host.querySelector('[data-fundo]')?.hasAttribute('inert')).toBe(false)
  expect(painel.querySelector('[data-painel-corpo] button')).toBe(editor)
  expect(editor?.textContent).toBe('Alterado')
  expect(montagensDoEditor).toBe(1)
})

test('confirmação central prevalece sobre a guarda do painel', async () => {
  simularLargura(820)
  const fechar = vi.fn()
  function Editor() {
    const [confirmando, confirmar] = useState(false)
    return <PainelLateralCrm titulo="Editor" aoFechar={fechar} rodape={null}>
      <button onClick={() => confirmar(true)}>Confirmar</button>
      <Dialog open={confirmando} onOpenChange={confirmar}>
        <DialogContent aria-describedby={undefined} showCloseButton={false} onOpenAutoFocus={evento => {
          evento.preventDefault()
          document.getElementById('titulo-confirmacao')?.focus()
        }}>
          <DialogTitle id="titulo-confirmacao" tabIndex={-1}>Confirmação</DialogTitle>
          <button>Descartar</button><button onClick={() => confirmar(false)}>Continuar editando</button>
        </DialogContent>
      </Dialog>
    </PainelLateralCrm>
  }
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root?.render(<Editor />))
  await act(async () => Array.from(host!.querySelectorAll('button')).find(botao => botao.textContent === 'Confirmar')?.click())
  const dialogo = document.querySelector('[data-slot="dialog-content"]')!
  expect(document.activeElement).toBe(dialogo.querySelector('h2'))
  expect(dialogo.closest('[inert]')).toBeNull()
  const acoes = dialogo.querySelectorAll('button')
  await act(async () => {
    acoes[1].focus()
    acoes[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  })
  expect(document.activeElement).toBe(acoes[0])
  await act(async () => acoes[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull()
  expect(fechar).not.toHaveBeenCalled()
})

test('painel anuncia título, recebe foco e deixa o quadro disponível', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<>
    <button type="button">Quadro</button>
    <PainelLateralCrm titulo="Negociação" descricao="Em negociação" aoFechar={fechar}>
      <button type="button">Registrar</button>
    </PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside[data-painel-lateral]')!
  expect(painel.getAttribute('aria-modal')).toBeNull()
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  const titulo = painel.querySelector('h2')!
  expect(painel.getAttribute('aria-labelledby')).toBe(titulo.id)
  expect(document.activeElement).toBe(titulo)
  expect(host.querySelector('button')?.disabled).toBe(false)
  await act(async () => titulo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).toHaveBeenCalledOnce()
})

test('envio pendente impede fechamento pelo botão e Escape', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<PainelLateralCrm titulo="Negociação" fecharBloqueado aoFechar={fechar}>Enviando</PainelLateralCrm>))
  const botao = host.querySelector('button')!
  expect(botao.disabled).toBe(true)
  await act(async () => host?.querySelector('h2')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).not.toHaveBeenCalled()
})


test('rótulo Voltar usa o mesmo fechamento pelo botão e Escape', async () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const fechar = vi.fn()
  await act(async () => root?.render(<PainelLateralCrm titulo="Empresa" rotuloFechar="Voltar" aoFechar={fechar}>Dados</PainelLateralCrm>))
  const botao = host.querySelector('button')!
  expect(botao.textContent).toBe('Voltar')
  await act(async () => botao.click())
  await act(async () => botao.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(fechar).toHaveBeenCalledTimes(2)
})

test('omitir rodapé mantém a base comum e não cria ações', async () => {
  simularLargura(820)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root?.render(<PainelLateralCrm titulo="Leitura" aoFechar={() => {}}>Conteúdo</PainelLateralCrm>))
  const painel = host.querySelector('aside')!
  expect(painel.getAttribute('data-painel-composicao')).toBe('padrao')
  expect(painel.getAttribute('aria-modal')).toBe('true')
  expect(painel.querySelector('[data-painel-corpo]')?.textContent).toBe('Conteúdo')
  expect(painel.querySelector('footer')).toBeNull()
})
