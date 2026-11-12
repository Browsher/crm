// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { FormularioBusca } from './formulario'
const { buscarEmpresasAcao, sugerirFiltrosBancoAcao } = vi.hoisted(() => ({
  buscarEmpresasAcao: vi.fn(), sugerirFiltrosBancoAcao: vi.fn(),
}))
vi.mock('./acoes', () => ({ buscarEmpresasAcao }))
vi.mock('./sugestoes-ia', () => ({ sugerirFiltrosBancoAcao }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
afterEach(async () => { if (raiz) await act(async () => raiz!.unmount()); host?.remove(); vi.unstubAllGlobals() })

async function abrirBanco(assistenteIaDisponivel = false) {
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={10} chaveInicial="busca-teste" assistenteIaDisponivel={assistenteIaDisponivel} />))
}

function mudarTexto(campo: HTMLInputElement | HTMLTextAreaElement, texto: string) {
  return act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo), 'value')!.set!.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

test('Banco exibe o botão desativado e Em breve por padrão', async () => {
  await abrirBanco()
  const botao = [...host!.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Sugerir filtros com IA')
  expect(botao?.disabled).toBe(true)
  expect(botao?.parentElement?.textContent).toContain('Em breve')
})

test('aplica a opção escolhida ao Banco sem submeter a busca e preserva os campos omitidos', async () => {
  sugerirFiltrosBancoAcao.mockResolvedValueOnce({ ok: true, valor: {
    regiao: { cidade: 'São Paulo', uf: 'SP', bairro: 'Brás' },
    sugestoes: [
      { titulo: 'Revendedores', descricao: 'Compram para revenda.', cnaes: [{ codigo: '4755502', descricao: 'Armarinhos' }] },
      { titulo: 'Instaladores', descricao: 'Compram para instalações.', cnaes: [{ codigo: '4321500', descricao: 'Instalação e manutenção elétrica' }] },
    ],
  } })
  await abrirBanco(true)
  const clicar = (nome: string, raizBusca: ParentNode = document) => act(async () => {
    [...raizBusca.querySelectorAll('button')].find(b => b.textContent?.trim() === nome)!.click()
  })
  const input = (nome: string) => {
    const label = [...host!.querySelectorAll('label')].find(l => l.textContent === nome)!
    return document.getElementById(label.htmlFor) as HTMLInputElement
  }
  await mudarTexto(input('Nome ou palavra-chave'), 'empresa existente')
  await mudarTexto(input('CNAEs principais'), '4755-5/02')
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await mudarTexto(painel.querySelector('textarea')!, 'Quero vender câmeras no Brás, em São Paulo.')
  await clicar('Gerar sugestões', painel)
  expect(painel.textContent).toContain('Instalação e manutenção elétrica')
  await act(async () => painel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click())
  await clicar('Aplicar filtros', painel)
  expect(painel.isConnected).toBe(false)
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
  expect(input('CNAEs principais').value).toBe('4321500')
  expect(input('Nome ou palavra-chave').value).toBe('empresa existente')
  const form = new FormData(host!.querySelector('form')!)
  expect(form.get('chave')).toBe('busca-teste')
  expect(JSON.parse(String(form.get('avancados')))).toMatchObject({
    cnaes: ['4321500'], palavras: ['empresa existente'], situacoes: ['ativa'], contato: 'telefoneoucelular',
    regioes: [{ estado: 'SP', cidade: 'São Paulo', bairros: ['Brás'] }],
  })
})
test('nova busca confirmada recebe outro UUID e atualização da mesma tentativa preserva sua identidade', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  raiz = createRoot(host)
  const primeira = '11111111-1111-4111-8111-111111111111'
  const segunda = '22222222-2222-4222-8222-222222222222'
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={10} chaveInicial={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(primeira)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial={segunda} buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={8} chaveInicial="33333333-3333-4333-8333-333333333333" buscaConcluidaId={primeira} />))
  expect(new FormData(host.querySelector('form')!).get('chave')).toBe(segunda)
})


test('escolhas, exclusões e UUID persistem quando os seis filtros são recolhidos', async () => {
  host = document.createElement('div'); document.body.append(host); raiz = createRoot(host)
  const chave = '11111111-1111-4111-8111-111111111111'
  await act(async () => raiz!.render(<FormularioBusca bloqueado={false} restante={100} chaveInicial={chave} />))
  const botao = (titulo: string) => [...host!.querySelectorAll('h2 button')].find(b => b.querySelector('strong')?.textContent === titulo) as HTMLButtonElement
  const escolha = (texto: string) => [...host!.querySelectorAll('label')].find(l => l.textContent === texto)!.querySelector<HTMLInputElement>('input')!
  await act(async () => botao('Perfil da empresa').click())
  await act(async () => escolha('Excluir optantes do MEI').click())
  expect(escolha('MEI').disabled).toBe(true)
  await act(async () => botao('Perfil da empresa').click())
  await act(async () => botao('Perfil da empresa').click())
  expect(escolha('Excluir optantes do MEI').checked).toBe(true)
  await act(async () => botao('Contatos e qualidade').click())
  await act(async () => escolha('Evitar emails de contabilidade').click())
  await act(async () => botao('Contatos e qualidade').click())
  const form = host.querySelector('form')!
  const dados = new FormData(form)
  const filtros = JSON.parse(String(dados.get('avancados')))
  expect(dados.get('chave')).toBe(chave)
  expect(filtros.excluirMei).toBe(true)
  expect(filtros.semEmailContabil).toBe(true)
  expect(host.querySelectorAll('h2 button')).toHaveLength(6)
  expect(form.querySelectorAll('form')).toHaveLength(0)
})
