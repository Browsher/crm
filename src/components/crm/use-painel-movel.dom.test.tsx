// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PainelLateralCrm } from './painel-lateral'
import { PainelArquivo } from '@/app/funil/arquivo-lateral'
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog'

const itemArquivo = { empresaId: 'empresa-a', negociacaoId: 'negociacao-a', nome: 'Aurora', arquivadaEm: '2026-11-05T14:00:00Z', versao: 4 }

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: ReturnType<typeof createRoot>
let host: HTMLDivElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  document.body.style.removeProperty('overflow')
  document.documentElement.style.removeProperty('overflow')
  vi.unstubAllGlobals()
})

test('guarda móvel contém Tab, Shift+Tab e foco programático no painel', async () => {
  await act(async () => root.render(<>
    <button data-fundo>Quadro</button>
    <PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={<button>Salvar</button>}>
      <input aria-label="Nome" /><button disabled>Indisponível</button>
      <button hidden>Oculto</button>
    </PainelLateralCrm>
  </>))
  const painel = host.querySelector('aside')!
  const fechar = painel.querySelector('button')!
  const salvar = Array.from(painel.querySelectorAll('button')).find(botao => botao.textContent === 'Salvar')!
  expect(document.activeElement).toBe(painel.querySelector('h2'))
  await act(async () => {
    salvar?.focus()
    salvar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  })
  expect(document.activeElement).toBe(fechar)
  await act(async () => fechar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(salvar)
  await act(async () => (host.querySelector('[data-fundo]') as HTMLElement).focus())
  expect(painel.contains(document.activeElement)).toBe(true)
})

test('cleanup conserva inert e overflow anteriores e libera somente o que alterou', async () => {
  document.body.style.setProperty('overflow', 'clip', 'important')
  document.documentElement.style.overflow = 'scroll'
  await act(async () => root.render(<>
    <div data-inerte inert><button>Anteriormente inerte</button></div>
    <div data-livre><button>Quadro</button></div>
    <PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={null}>Dados</PainelLateralCrm>
  </>))
  const inerte = host.querySelector('[data-inerte]')!
  const livre = host.querySelector('[data-livre]')!
  expect(livre.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  await act(async () => root.render(<>
    <div data-inerte inert><button>Anteriormente inerte</button></div>
    <div data-livre><button>Quadro</button></div>
  </>))
  expect(inerte.hasAttribute('inert')).toBe(true)
  expect(livre.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('clip')
  expect(document.body.style.getPropertyPriority('overflow')).toBe('important')
  expect(document.documentElement.style.overflow).toBe('scroll')
})

test('cleanup não sobrescreve estilos alterados por outro dono durante o painel', async () => {
  await act(async () => root.render(<PainelLateralCrm titulo="Editor" aoFechar={() => {}} rodape={null}>Dados</PainelLateralCrm>))
  expect(document.body.style.overflow).toBe('hidden')
  document.body.style.overflow = 'clip'
  await act(async () => root.render(null))
  expect(document.body.style.overflow).toBe('clip')
})

test('omitir rodapé conserva isolamento e rolagem móvel da composição comum', async () => {
  await act(async () => root.render(<>
    <button data-fundo>Quadro</button>
    <PainelLateralCrm titulo="Leitura" aoFechar={() => {}}>Dados</PainelLateralCrm>
  </>))
  expect(host.querySelector('[data-fundo]')?.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  expect(host.querySelector('aside')?.getAttribute('data-painel-composicao')).toBe('padrao')
  expect(host.querySelector('footer')).toBeNull()
})

test.each([390, 1440])('remoção do item focado do Arquivo respeita o contexto em %spx', async largura => {
  vi.stubGlobal('matchMedia', () => ({ matches: largura <= 820, addEventListener() {}, removeEventListener() {} }))
  const devolver = vi.fn()
  function Dono() {
    const [itens, definirItens] = useState([itemArquivo])
    return <>
      <button data-quadro>Quadro</button>
      <PainelArquivo arquivos={itens} bloqueado={false} fechandoBloqueado={false} aoFechar={() => {}} aoConfirmar={() => {}}
        aoDevolver={item => { devolver(item); definirItens([]) }} />
    </>
  }
  await act(async () => root.render(<Dono />))
  const painel = host.querySelector('aside')!
  const acao = painel.querySelector<HTMLButtonElement>('li button')!
  await act(async () => { acao.focus(); acao.click() })
  expect(devolver).toHaveBeenCalledOnce()
  expect(devolver).toHaveBeenCalledWith(itemArquivo)
  expect(painel.querySelector('li')).toBeNull()
  if (largura <= 820) expect(document.activeElement).toBe(painel.querySelector('h2'))
  else {
    expect(document.activeElement).toBe(document.body)
    const quadro = host.querySelector<HTMLButtonElement>('[data-quadro]')!
    await act(async () => quadro.focus())
    expect(document.activeElement).toBe(quadro)
  }
})

test('remoção de item do Arquivo não toma o foco de confirmação central aberta', async () => {
  let remover!: () => void, confirmar!: () => void
  function Dono() {
    const [itens, definirItens] = useState([itemArquivo])
    const [aberto, definirAberto] = useState(false)
    remover = () => definirItens([])
    confirmar = () => definirAberto(true)
    return <>
      <PainelArquivo arquivos={itens} bloqueado={false} fechandoBloqueado={false} aoFechar={() => {}} aoConfirmar={() => {}} aoDevolver={() => {}} />
      <Dialog open={aberto} onOpenChange={definirAberto}>
        <DialogContent aria-describedby={undefined} showCloseButton={false} onOpenAutoFocus={evento => {
          evento.preventDefault()
          document.getElementById('confirmacao-remocao')?.focus()
        }}>
          <DialogTitle id="confirmacao-remocao" tabIndex={-1}>Conferir alvo</DialogTitle>
          <button>Continuar editando</button>
        </DialogContent>
      </Dialog>
    </>
  }
  await act(async () => root.render(<Dono />))
  await act(async () => host.querySelector<HTMLButtonElement>('li button')!.focus())
  await act(async () => confirmar())
  const titulo = document.getElementById('confirmacao-remocao')!
  expect(document.activeElement).toBe(titulo)
  await act(async () => remover())
  expect(document.activeElement).toBe(titulo)
  expect(titulo.closest('[inert]')).toBeNull()
})

test.each(['unmount', 'desktop'])('callback de mutação tardio não restaura foco após %s', async destino => {
  let movel = true, atualizar!: () => void, disparar!: () => void
  vi.stubGlobal('matchMedia', () => ({ get matches() { return movel }, addEventListener: (_: string, callback: () => void) => { atualizar = callback }, removeEventListener() {} }))
  const ObservadorOriginal = globalThis.MutationObserver
  vi.stubGlobal('MutationObserver', class extends ObservadorOriginal {
    constructor(callback: MutationCallback) {
      super(callback)
      disparar = () => callback([], this)
    }
  })
  await act(async () => root.render(<>
    <button data-quadro>Quadro</button>
    <PainelLateralCrm titulo="Arquivo" aoFechar={() => {}}>Conteúdo</PainelLateralCrm>
  </>))
  const focoAntigo = vi.spyOn(host.querySelector('aside h2') as HTMLElement, 'focus')
  await act(async () => {
    if (destino === 'unmount') root.render(<button data-quadro>Outro quadro</button>)
    else { movel = false; atualizar() }
  })
  const quadro = host.querySelector<HTMLButtonElement>('[data-quadro]')!
  await act(async () => { quadro.focus(); disparar() })
  expect(document.activeElement).toBe(quadro)
  expect(focoAntigo).not.toHaveBeenCalled()
})
