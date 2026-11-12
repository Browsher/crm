// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PlanejamentoSemanal } from './planejamento'
import type { PlanoGoogle } from '@/src/features/google/tipos'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
const { salvarSemanaAcao } = vi.hoisted(() => ({ salvarSemanaAcao: vi.fn(async () => ({ erro: null, salvo: true })) }))
vi.mock('./acoes', () => ({ salvarSemanaAcao, copiarPlanoAcao: async () => ({ erro: null, salvo: true }), sincronizarPlanoAcao: async () => ({ erro: null }) }))
const { sugerirFiltrosGoogleAcao } = vi.hoisted(() => ({ sugerirFiltrosGoogleAcao: vi.fn() }))
vi.mock('./sugestoes-ia', () => ({ sugerirFiltrosGoogleAcao }))
const elemento = document.createElement('div')
document.body.append(elemento)
let raiz: ReturnType<typeof createRoot> | undefined
afterEach(async () => { await act(async () => raiz?.unmount()); elemento.replaceChildren() })

test('assistente fica Em breve e indisponível nos dias editáveis por padrão', async () => {
  await abrirSemana()
  await clicar('Editar planejamento')
  const botao = Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Sugerir filtros com IA')
  expect(botao?.disabled).toBe(true)
  expect(elemento.textContent).toContain('Em breve')
  expect(document.querySelector('[data-painel-lateral]')).toBeNull()
})

test('assistente abre na lateral e aplica só a opção escolhida ao rascunho daquele dia', async () => {
  salvarSemanaAcao.mockClear()
  sugerirFiltrosGoogleAcao.mockResolvedValueOnce({ ok: true, valor: {
    regiao: { cidade: 'São Paulo', uf: 'SP', bairro: 'Brás' },
    sugestoes: [
      { titulo: 'Lojas', descricao: 'Revenda de câmeras.', nicho: 'Lojas de segurança', termos: 'CFTV' },
      { titulo: 'Instaladores', descricao: 'Instalam câmeras.', nicho: 'Instalação de câmeras', termos: 'monitoramento' },
    ],
  } })
  const plano = { dia: '2026-10-23', nicho: 'Lojas', cidade: 'Santos', bairro: '', uf: 'SP', criterios: { excluir: 'lojas de usados' } } as PlanoGoogle
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-22', '2026-10-23', '2026-10-26']} planos={[plano]} hoje="2026-10-22" assistenteIaDisponivel />))
  await clicar('Editar planejamento')
  const linhas = elemento.querySelectorAll('tbody tr')
  expect(linhas[0].textContent).not.toContain('Sugerir filtros com IA')
  await clicar('Sugerir filtros com IA', linhas[1])
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  expect(painel.textContent).toContain('O que você quer vender?')
  await alterarTexto(painel, 'descricao', 'Quero vender câmeras Wi-Fi no Brás, em São Paulo.')
  await clicar('Gerar sugestões', painel)
  expect(painel.querySelectorAll('input[type="radio"]')).toHaveLength(2)
  await act(async () => painel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click())
  await clicar('Aplicar filtros', painel)
  expect(painel.isConnected).toBe(false)
  expect(salvarSemanaAcao).not.toHaveBeenCalled()
  const rascunho = JSON.parse(elemento.querySelector<HTMLInputElement>('input[name="dias"]')!.value)
  expect(rascunho[0]).toMatchObject({ dia: '2026-10-23', nicho: 'Instalação de câmeras', cidade: 'São Paulo', uf: 'SP', bairro: 'Brás', criterios: { termos: 'monitoramento', excluir: 'lojas de usados' } })
  expect(rascunho[1]).toMatchObject({ dia: '2026-10-26', nicho: '', cidade: '' })
})

test('uma geração pendente bloqueia envio duplicado e falha invalida as sugestões anteriores', async () => {
  salvarSemanaAcao.mockClear()
  sugerirFiltrosGoogleAcao.mockClear()
  sugerirFiltrosGoogleAcao.mockResolvedValueOnce({ ok: true, valor: {
    sugestoes: [{ titulo: 'Lojas', descricao: 'Revenda de câmeras.', nicho: 'Lojas', termos: 'CFTV' }],
  } })
  let concluir!: (resultado: { ok: false; motivo: string }) => void
  sugerirFiltrosGoogleAcao.mockReturnValueOnce(new Promise(resolve => { concluir = resolve }))
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[]} hoje="2026-10-22" assistenteIaDisponivel />))
  await clicar('Editar planejamento')
  await clicar('Sugerir filtros com IA')
  const painel = document.querySelector('[role="dialog"][data-painel-lateral]')!
  await alterarTexto(painel, 'descricao', 'Quero vender câmeras.')
  await clicar('Gerar sugestões', painel)
  const formulario = painel.querySelector('form')!
  const enviar = () => formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await act(async () => { enviar(); enviar() })
  expect(sugerirFiltrosGoogleAcao).toHaveBeenCalledTimes(2)
  expect(painel.querySelector('input[type="radio"]')).toBeNull()
  expect(Array.from(painel.querySelectorAll('button')).find(b => b.textContent === 'Aplicar filtros')?.disabled).toBe(true)
  await act(async () => concluir({ ok: false, motivo: 'Assistente indisponível.' }))
  expect(painel.querySelector('[role="alert"]')?.textContent).toContain('Assistente indisponível.')
  expect(elemento.querySelector<HTMLInputElement>('input[name^="nicho-"]')?.value).toBe('')
  expect(salvarSemanaAcao).not.toHaveBeenCalled()
  await clicar('Fechar', painel)
  expect(document.querySelector('[data-slot="dialog-content"]')?.textContent).toContain('Descartar alterações?')
  await clicar('Descartar alterações')
  expect(painel.isConnected).toBe(false)
})

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
test('critérios abrem na lateral e cancelar confirma no centro sem alterar rascunho da semana', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[]} hoje="2026-10-22" rotinaIniciada={false} />))
  await act(async () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Editar planejamento')!.click())
  const botao = Array.from(elemento.querySelectorAll('button')).find(b => b.textContent?.includes('Critérios de busca'))!
  await act(async () => botao.click())
  const dialogo = document.querySelector('[role="dialog"][data-painel-lateral]')!
  expect(dialogo.textContent).toContain('Contatos e presença digital')
  await clicar('Contatos e presença digital', dialogo)
  await act(async () => dialogo.querySelector<HTMLInputElement>('input[value="fixo"]')!.click())
  await clicar('Cancelar', dialogo)
  expect(dialogo.isConnected).toBe(true)
  expect(document.querySelector('[data-slot="dialog-content"]')?.textContent).toContain('Descartar alterações?')
  await clicar('Descartar alterações')
  await act(async () => botao.click())
  await clicar('Contatos e presença digital')
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[value="fixo"]')?.checked).toBe(false)
})

test('critérios preservam os três grupos e o rodapé aplica apenas ao rascunho da semana', async () => {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-22', '2026-10-23']} planos={[]} hoje="2026-10-22" />))
  await act(async () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Editar planejamento')!.click())
  const abrir = () => Array.from(elemento.querySelectorAll('button')).find(b => b.textContent === 'Critérios de busca')!.click()
  await act(async () => abrir())
  const dialogo = document.querySelector('[role="dialog"]')!
  await clicar('Empresas e produtos', dialogo)
  expect(dialogo.querySelector('textarea[name="termos"]')?.getAttribute('data-slot')).toBe('textarea')
  await alterarTexto(dialogo, 'termos', 'segurança eletrônica')
  await clicar('Voltar', dialogo)
  expect(document.activeElement?.textContent).toBe('Empresas e produtos')
  await clicar('Contatos e presença digital', dialogo)
  expect(dialogo.querySelector('input[value="fixo"]')?.getAttribute('data-slot')).toBe('choice')
  await act(async () => dialogo.querySelector<HTMLInputElement>('input[value="fixo"]')!.click())
  await clicar('Voltar', dialogo)
  await clicar('Preferências e restrições', dialogo)
  await alterarTexto(dialogo, 'excluir', 'lojas de usados')
  await clicar('Voltar', dialogo)
  await clicar('Empresas e produtos', dialogo)
  expect(dialogo.querySelector<HTMLTextAreaElement>('[name="termos"]')?.value).toBe('segurança eletrônica')
  const aplicar = dialogo.querySelector<HTMLButtonElement>('button[type="submit"]')!
  expect(aplicar.form).toBe(dialogo.querySelector('form'))
  expect(aplicar.closest('form')).toBeNull()
  await clicar('Aplicar critérios', dialogo)
  expect(salvarSemanaAcao).not.toHaveBeenCalled()
  const payload = JSON.parse(elemento.querySelector<HTMLInputElement>('input[name="dias"]')!.value)
  expect(payload).toHaveLength(1)
  expect(payload[0]).toMatchObject({ dia: '2026-10-23', criterios: { telefone: ['fixo'], nota: null, termos: 'segurança eletrônica', excluir: 'lojas de usados' } })
  await act(async () => abrir())
  await clicar('Contatos e presença digital')
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[value="fixo"]')!.checked).toBe(true)
})
function alterarTexto(onde: ParentNode, nome: string, valor: string) {
  return act(async () => {
    const campo = onde.querySelector<HTMLTextAreaElement>(`textarea[name="${nome}"]`)!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function clicar(rotulo: string, onde: ParentNode = document) {
  return act(async () => {
    Array.from(onde.querySelectorAll('button')).find(b => b.textContent === rotulo || b.getAttribute('aria-label') === rotulo)!.click()
  })
}
function alterarNicho(valor: string) {
  return act(async () => {
    const campo = elemento.querySelector<HTMLInputElement>('input[name^="nicho-"]')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function temProtecaoDeUnload() {
  return !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))
}
async function abrirSemana(historico: PlanoGoogle[] = []) {
  raiz = createRoot(elemento)
  await act(async () => raiz!.render(<PlanejamentoSemanal dias={['2026-10-23']} planos={[]} hoje="2026-10-22" historico={historico} />))
}

test('semana intocada ou revertida fecha sem confirmação nem proteção de unload', async () => {
  await abrirSemana()
  await clicar('Editar planejamento')
  expect(temProtecaoDeUnload()).toBe(false)
  await clicar('Cancelar')
  expect(elemento.querySelector('input[name^="nicho-"]')).toBeNull()
  await clicar('Editar planejamento')
  await alterarNicho('Lojas')
  expect(temProtecaoDeUnload()).toBe(true)
  await alterarNicho('')
  expect(temProtecaoDeUnload()).toBe(false)
  await clicar('Cancelar')
  expect(elemento.querySelector('input[name^="nicho-"]')).toBeNull()
})

test('cancelar edição real pede decisão e continuar mantém o nicho digitado', async () => {
  await abrirSemana()
  await clicar('Editar planejamento')
  await alterarNicho('Lojas')
  await clicar('Cancelar')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando')
  expect(elemento.querySelector<HTMLInputElement>('input[name^="nicho-"]')?.value).toBe('Lojas')
  await clicar('Cancelar')
  await clicar('Descartar alterações')
  expect(elemento.querySelector('input[name^="nicho-"]')).toBeNull()
  expect(elemento.querySelector('tbody')?.textContent).not.toContain('Lojas')
})

test('espelhar com seleções pede descarte e pode retomar sem desmarcar', async () => {
  const origem = { id: 'pedido', dia: '2026-10-22', nicho: 'Papelarias', revisao: 1 } as PlanoGoogle
  await abrirSemana([origem])
  await clicar('Espelhar um dia')
  const editor = document.querySelector('[role="dialog"][data-painel-lateral]')!
  const enviar = editor.querySelector<HTMLButtonElement>('button[type="submit"]')!
  expect(enviar.form).toBe(editor.querySelector('form'))
  expect(enviar.closest('form')).toBeNull()
  await act(async () => editor.querySelector<HTMLInputElement>('input[value="criterios"]')!.click())
  await clicar('Cancelar', editor)
  expect(document.body.textContent).toContain('Descartar alterações?')
  await clicar('Continuar editando')
  expect(editor.querySelector<HTMLInputElement>('input[value="criterios"]')?.checked).toBe(true)
  await clicar('Cancelar', editor)
  await clicar('Descartar alterações')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})


test('Back autorizado com semana e critérios alterados não rearma a guarda ao desmontar os dois editores', async () => {
  const armar = vi.spyOn(history, 'pushState').mockImplementation(() => {})
  const voltar = vi.spyOn(history, 'go').mockImplementation(() => {})
  const tamanho = vi.spyOn(history, 'length', 'get').mockReturnValue(3)
  try {
    await abrirSemana()
    await clicar('Editar planejamento')
    await alterarNicho('Lojas')
    await clicar('Critérios de busca')
    const editor = document.querySelector('[role="dialog"]')!
    await clicar('Contatos e presença digital', editor)
    await act(async () => editor.querySelector<HTMLInputElement>('input[value="fixo"]')!.click())
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
    expect(armar).toHaveBeenCalledTimes(2)
    await clicar('Descartar alterações')
    expect(voltar).toHaveBeenCalledWith(-2)
    expect(armar).toHaveBeenCalledTimes(2)
  } finally {
    armar.mockRestore()
    voltar.mockRestore()
    tamanho.mockRestore()
  }
})
