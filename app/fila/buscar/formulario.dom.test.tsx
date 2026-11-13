// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import { FormularioBusca } from './formulario'
const { buscarEmpresasAcao, sugerirFiltrosBancoAcao } = vi.hoisted(() => ({
  buscarEmpresasAcao: vi.fn(), sugerirFiltrosBancoAcao: vi.fn(),
}))
vi.mock('./acoes', () => ({ buscarEmpresasAcao }))
vi.mock('./sugestoes-ia', () => ({ sugerirFiltrosBancoAcao }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
let raiz: ReturnType<typeof createRoot> | null = null
let host: HTMLDivElement | null = null
beforeEach(() => { buscarEmpresasAcao.mockClear(); sugerirFiltrosBancoAcao.mockReset() })
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

function clicar(nome: string, raizBusca: ParentNode = document) {
  return act(async () => {
    [...raizBusca.querySelectorAll('button')].find(b => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)!.click()
  })
}

function escolherEstado(campo: HTMLSelectElement, valor: string) {
  return act(async () => {
    campo.value = valor
    campo.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function filtrosBanco() {
  const form = new FormData(host!.querySelector('form')!)
  return JSON.parse(String(form.get('avancados')))
}

function campoBanco(rotulo: string, escopo: ParentNode) {
  return [...escopo.querySelectorAll('label')].find(label => label.textContent?.trim() === rotulo)?.control as HTMLInputElement | undefined
}

function abrirGrupoBanco(titulo: string) {
  return act(async () => {
    [...host!.querySelectorAll<HTMLButtonElement>('h2 button')].find(b => b.querySelector('strong')?.textContent === titulo)!.click()
  })
}

async function gerarSugestoesBanco(...sugestoes: SugestaoBanco[]) {
  sugerirFiltrosBancoAcao.mockResolvedValueOnce({ ok: true, valor: { sugestoes } })
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'QS-T-001')
  await act(async () => painel.querySelector<HTMLElement>('[role="option"]')!.click())
  await clicar('Gerar sugestões', painel)
  return painel
}

function opcaoBanco(painel: Element, titulo: string) {
  return [...painel.querySelectorAll<HTMLElement>('[role="group"]')].find(grupo =>
    document.getElementById(grupo.getAttribute('aria-labelledby') ?? '')?.textContent === titulo,
  )!
}

const lojasGames: SugestaoBanco = {
  titulo: 'Lojas de games', descricao: 'Compram projetores para revenda.',
  cnaes: [{ codigo: '4763601', descricao: 'Comércio varejista de brinquedos e artigos recreativos' }],
  perfilEmpresa: {
    portes: { valor: ['ME', 'EPP'], motivo: 'Podem revender em volumes menores.' },
    contato: { valor: 'email', motivo: 'Permite enviar o catálogo.' },
  },
}

test('Banco exibe o botão desativado e Em breve por padrão', async () => {
  await abrirBanco()
  const botao = [...host!.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Sugerir filtros com IA')
  expect(botao?.disabled).toBe(true)
  expect(botao?.parentElement?.textContent).toContain('Em breve')
})

test('Banco alterna o robô entre escolha, geração e recuperação com CNAEs do catálogo', async () => {
  let responder!: (valor: unknown) => void
  sugerirFiltrosBancoAcao.mockReturnValueOnce(new Promise(resolve => { responder = resolve }))
  await abrirBanco(true)
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  const mascote = () => painel.querySelector('header [data-mascote-assistente]')
  const aplicar = [...painel.querySelectorAll('button')].find(botao => botao.textContent === 'Aplicar filtros')!
  const status = painel.querySelector('footer [role="status"]')!
  expect(mascote()?.getAttribute('data-mascote-assistente')).toBe('padrao')
  expect(mascote()?.getAttribute('aria-hidden')).toBe('true')
  expect(painel.textContent).toContain('Escolha um produto para receber sugestões de filtros.')
  expect(aplicar.disabled).toBe(true)

  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'QS-T-001')
  await act(async () => painel.querySelector<HTMLElement>('[role="option"]')!.click())
  await clicar('Gerar sugestões', painel)
  expect(mascote()?.getAttribute('data-mascote-assistente')).toBe('gerando')
  expect(status.textContent).toBe('Preparando sugestões para este produto…')
  expect(aplicar.disabled).toBe(true)

  await act(async () => responder({ ok: true, valor: { fonte: 'catalogo', sugestoes: [
    { titulo: lojasGames.titulo, descricao: 'Atividade verificada no catálogo.', cnaes: lojasGames.cnaes },
  ] } }))
  expect(mascote()?.getAttribute('data-mascote-assistente')).toBe('catalogo')
  expect(painel.querySelector('[role="note"]')?.textContent).toContain('Você ainda pode aplicar os CNAEs do catálogo.')
  expect(status.textContent).toBe('Perfil de comprador temporariamente indisponível. Você ainda pode aplicar os CNAEs do catálogo.')
  expect(aplicar.disabled).toBe(false)
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco().cnaes).toEqual(['4763601'])
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test('aplica a opção escolhida ao Banco sem submeter a busca e preserva os campos omitidos', async () => {
  sugerirFiltrosBancoAcao.mockResolvedValueOnce({ ok: true, valor: {
    sugestoes: [
      { titulo: 'Revendedores', descricao: 'Compram para revenda.', cnaes: [{ codigo: '4755502', descricao: 'Armarinhos' }] },
      { titulo: 'Instaladores', descricao: 'Compram para instalações.', cnaes: [{ codigo: '4321500', descricao: 'Instalação e manutenção elétrica' }] },
    ],
  } })
  await abrirBanco(true)
  const input = (nome: string) => {
    const label = [...host!.querySelectorAll('label')].find(l => l.textContent === nome)!
    return document.getElementById(label.htmlFor) as HTMLInputElement
  }
  await mudarTexto(input('Nome ou palavra-chave'), 'empresa existente')
  await mudarTexto(input('CNAEs principais'), '4755-5/02')
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  expect(painel.textContent).not.toContain('Outro produto')
  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'IC-8177')
  await act(async () => painel.querySelector<HTMLElement>('[role="option"]')!.click())
  await escolherEstado(painel.querySelector<HTMLSelectElement>('select[name="estado"]')!, 'SP')
  await mudarTexto(campoBanco('Cidade', painel)!, 'São Paulo')
  await mudarTexto(campoBanco('Bairros (opcional)', painel)!, 'Brás')
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

test('Banco aplica somente o perfil marcado no público escolhido e muda o modo de abertura', async () => {
  await abrirBanco(true)
  await abrirGrupoBanco('Perfil da empresa')
  await act(async () => campoBanco('DEMAIS', host!)!.click())
  const painel = await gerarSugestoesBanco(lojasGames, {
    titulo: 'Distribuidores', descricao: 'Compram projetores por caixa.',
    cnaes: [{ codigo: '4649499', descricao: 'Comércio atacadista de outros artigos de uso pessoal' }],
    perfilEmpresa: { aberturaUltimosDias: { valor: 60, motivo: 'Lojas novas estão montando o catálogo.' } },
  })
  expect(painel.textContent).toContain('Podem revender em volumes menores.')
  const lojas = opcaoBanco(painel, 'Lojas de games')
  const distribuidores = opcaoBanco(painel, 'Distribuidores')
  expect(lojas).toBeDefined()
  expect(distribuidores).toBeDefined()
  const porte = campoBanco('Porte sugerido: ME, EPP', lojas)!
  expect(porte.checked).toBe(false)
  await act(async () => porte.click())
  await act(async () => distribuidores.querySelector<HTMLInputElement>('input[type="radio"]')!.click())
  const abertura = campoBanco('Data de abertura sugerida: Últimos 60 dias', distribuidores)!
  expect(abertura.checked).toBe(false)
  await act(async () => abertura.click())
  await act(async () => lojas.querySelector<HTMLInputElement>('input[type="radio"]')!.click())
  expect(campoBanco('Porte sugerido: ME, EPP', lojas)?.checked).toBe(true)
  await act(async () => distribuidores.querySelector<HTMLInputElement>('input[type="radio"]')!.click())
  expect(campoBanco('Data de abertura sugerida: Últimos 60 dias', distribuidores)?.checked).toBe(true)
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco()).toMatchObject({ cnaes: ['4649499'], portes: ['DEMAIS'], aberturaUltimosDias: '60', contato: 'telefoneoucelular' })
  expect(host!.querySelector<HTMLSelectElement>('#modo-abertura-banco')?.value).toBe('ultimosDias')
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test('Banco bloqueia capital inválido e mantém o limite do rascunho quando o campo fica vazio', async () => {
  await abrirBanco(true)
  await abrirGrupoBanco('Capital e data de abertura')
  await mudarTexto(campoBanco('Capital máximo (R$, sem centavos)', host!)!, '500')
  const painel = await gerarSugestoesBanco(lojasGames)
  const minimo = campoBanco('Capital mínimo (R$, sem centavos)', painel)
  const maximo = campoBanco('Capital máximo (R$, sem centavos)', painel)
  expect(minimo?.value).toBe('')
  expect(maximo?.value).toBe('')
  const aplicar = [...painel.querySelectorAll('button')].find(botao => botao.textContent === 'Aplicar filtros')!
  await mudarTexto(minimo!, '100,50')
  expect(aplicar.disabled).toBe(true)
  expect(painel.querySelector('[role="alert"]')?.textContent).toMatch(/capital/i)
  await mudarTexto(minimo!, '501')
  expect(aplicar.disabled).toBe(true)
  await mudarTexto(minimo!, '250')
  expect(aplicar.disabled).toBe(false)
  await act(async () => minimo!.form!.requestSubmit())
  expect(filtrosBanco().capitalMinimo).toBe('')
  expect(sugerirFiltrosBancoAcao).toHaveBeenCalledExactlyOnceWith({ produto: { sku: 'QS-T-001' } })
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco()).toMatchObject({ capitalMinimo: '250', capitalMaximo: '500' })
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test('Banco mostra quais filtros do rascunho o MEI substitui e bloqueia uma combinação incompatível', async () => {
  await abrirBanco(true)
  await abrirGrupoBanco('Perfil da empresa')
  await act(async () => campoBanco('ME', host!)!.click())
  await act(async () => campoBanco('Excluir optantes do MEI', host!)!.click())
  await mudarTexto(campoBanco('Exclusão do MEI a partir de', host!)!, '2024-01-01')
  const painel = await gerarSugestoesBanco({
    ...lojasGames,
    perfilEmpresa: {
      mei: { valor: 'somente', motivo: 'Podem comprar em pequenos lotes.' },
      regime: { valor: 'fora_simples', motivo: 'Segmenta operações maiores.' },
    },
  })
  const mei = campoBanco('MEI sugerido: Somente MEI', painel)
  expect(mei?.checked).toBe(false)
  await act(async () => mei!.click())
  expect(painel.textContent).toContain('Filtros do rascunho que serão substituídos')
  expect(filtrosBanco()).toMatchObject({ portes: ['ME'], excluirMei: true, meiExclusaoDe: '2024-01-01' })
  const regime = campoBanco('Regime tributário sugerido: Fora do Simples Nacional', painel)!
  await act(async () => regime.click())
  const aplicar = [...painel.querySelectorAll('button')].find(botao => botao.textContent === 'Aplicar filtros')!
  expect(aplicar.disabled).toBe(true)
  expect(painel.querySelector('[role="alert"]')?.textContent).toMatch(/MEI|Simples/i)
  await act(async () => regime.click())
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco()).toMatchObject({ portes: ['MEI'], excluirMei: false, meiExclusaoDe: '', meiExclusaoAte: '' })
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test.each([
  { caso: 'herdadas', editar: false, esperadas: [{ estado: 'SP', cidade: '', bairros: [] }, { estado: '', cidade: 'Niterói', bairros: [] }] },
  { caso: 'editadas', editar: true, esperadas: [{ estado: 'SP', cidade: 'Santos', bairros: ['Gonzaga', 'Boqueirão'] }, { estado: '', cidade: 'Niterói', bairros: [] }] },
])('mostra todas as regiões $caso no Banco e as preserva ao aplicar', async ({ editar, esperadas }) => {
  sugerirFiltrosBancoAcao.mockResolvedValueOnce({ ok: true, valor: {
    regiao: { cidade: 'Fortaleza', uf: 'CE' },
    sugestoes: [{ titulo: 'Revendedores de acessórios pet', descricao: 'Vendem acessórios de passeio.', cnaes: [
      { codigo: '4649499', descricao: 'Comércio atacadista de outros equipamentos e artigos de uso pessoal e doméstico não especificados anteriormente', amplo: true, motivo: 'Abrange artigos para animais de estimação.' },
    ] }],
  } })
  await abrirBanco(true)
  const localizacao = [...host!.querySelectorAll<HTMLButtonElement>('h2 button')].find(b => b.querySelector('strong')?.textContent === 'Localização')!
  await act(async () => localizacao.click())
  await escolherEstado(host!.querySelector('#estado-banco-0')!, 'SP')
  await clicar('Adicionar outra cidade ou estado', host!)
  await mudarTexto(host!.querySelectorAll<HTMLInputElement>('input[placeholder="Ex.: São Paulo…"]')[1], 'Niterói')
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'QS-023')
  const opcoes = [...painel.querySelectorAll<HTMLElement>('[role="option"]')]
  expect(opcoes.some(opcao => opcao.firstElementChild?.textContent?.endsWith('QS-023-1'))).toBe(true)
  await act(async () => opcoes.find(opcao => opcao.firstElementChild?.textContent?.endsWith('QS-023'))!.click())
  if (editar) {
    await mudarTexto(painel.querySelector<HTMLInputElement>('[name="cidade"]')!, 'Santos')
    await mudarTexto(painel.querySelector<HTMLInputElement>('[name="bairros"]')!, 'Gonzaga, Boqueirão')
  }
  await clicar('Gerar sugestões', painel)
  expect(sugerirFiltrosBancoAcao).toHaveBeenCalledWith({ produto: { sku: 'QS-023' }, regioes: esperadas })
  const previa = painel.querySelector('[aria-label="Regiões ao aplicar"]')!
  expect(previa.querySelectorAll('li')).toHaveLength(2)
  expect(previa.textContent).toContain('Niterói')
  expect(previa.textContent).toContain(editar ? 'Gonzaga, Boqueirão' : 'SP')
  expect(previa.textContent).not.toContain('Fortaleza')
  expect(painel.textContent).toContain('Escopo amplo')
  expect(painel.textContent).toContain('Abrange artigos para animais de estimação.')
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco().regioes).toEqual(esperadas)
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test('remover a última região no painel limpa o rascunho do Banco ao aplicar', async () => {
  sugerirFiltrosBancoAcao.mockResolvedValueOnce({ ok: true, valor: {
    regiao: { cidade: 'Fortaleza', uf: 'CE' },
    sugestoes: [{ titulo: 'Revendedores de acessórios pet', descricao: 'Vendem acessórios de passeio.', cnaes: [
      { codigo: '4789004', descricao: 'Comércio varejista de animais vivos e de artigos e alimentos para animais de estimação' },
    ] }],
  } })
  await abrirBanco(true)
  await escolherEstado(host!.querySelector('#estado-banco-0')!, 'SP')
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'QS-023')
  await act(async () => [...painel.querySelectorAll<HTMLElement>('[role="option"]')].find(opcao => opcao.firstElementChild?.textContent?.endsWith('QS-023'))!.click())
  await clicar('Remover região', painel)
  await clicar('Gerar sugestões', painel)
  expect(sugerirFiltrosBancoAcao).toHaveBeenCalledWith({ produto: { sku: 'QS-023' }, regioes: [] })
  expect(painel.querySelector('[aria-label="Regiões ao aplicar"]')?.textContent).toContain('Nenhuma região definida.')
  await clicar('Aplicar filtros', painel)
  expect(filtrosBanco().regioes).toEqual([])
  expect(buscarEmpresasAcao).not.toHaveBeenCalled()
})

test('ao editar região no assistente do Banco, cidade e bairros seguem a UF atual', async () => {
  await abrirBanco(true)
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await mudarTexto(painel.querySelector<HTMLInputElement>('[name="produto"]')!, 'IC-8177')
  await act(async () => painel.querySelector<HTMLElement>('[role="option"]')!.click())
  const estado = painel.querySelector<HTMLSelectElement>('[name="estado"]')!
  const cidade = painel.querySelector<HTMLInputElement>('[name="cidade"]')!
  const bairros = painel.querySelector<HTMLInputElement>('[name="bairros"]')!
  await escolherEstado(estado, 'SP')
  await mudarTexto(cidade, 'Santos')
  await mudarTexto(bairros, 'Gonzaga')
  await mudarTexto(cidade, 'Campinas')
  expect(bairros.value).toBe('')
  await mudarTexto(bairros, 'Cambuí')
  await escolherEstado(estado, 'RJ')
  expect(cidade.value).toBe('')
  expect(bairros.value).toBe('')
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
