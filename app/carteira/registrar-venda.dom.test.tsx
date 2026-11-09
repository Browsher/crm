// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import type { EmpresaComigo } from '@/src/lib/agenda-atendimento'
import type { EstadoVenda } from '@/src/lib/venda-envio'
const mocks=vi.hoisted(()=>({venda:vi.fn(),primeira:vi.fn(),refresh:vi.fn(),replace:vi.fn(),back:vi.fn()}))
vi.mock('./venda-acao',()=>({vendaCarteiraAcao:mocks.venda}))
vi.mock('../funil/acoes',()=>({vendaAcao:mocks.primeira}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:mocks.refresh,replace:mocks.replace,back:mocks.back})}))
vi.mock('@/src/components/crm/tema',()=>({useTemaCrm:()=> 'light'}))
import { Ficha } from './[id]/ficha'

const empresa: EmpresaComigo = {
  id: 'empresa', cnpj: null, razaoSocial: 'Aurora', nomeFantasia: null, cnaePrincipal: null,
  ultimoContato: null, contatoNome: null, telefone: null, email: null, cep: null, endereco: null,
  reservadoAte: null, posse: true, proximoPasso: null, proximoPassoData: null,
  situacaoRetorno: 'sem_data', vencido: false, situacao: 'cliente', versao: 1,
}

let root:ReturnType<typeof createRoot>|undefined,host:HTMLDivElement|undefined
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();sessionStorage.clear();history.replaceState(null, '', '/');vi.clearAllMocks();vi.restoreAllMocks();vi.unstubAllGlobals()})
async function renderizar(cliente = true, interceptada = false) {
  await act(async () => root!.render(<Ficha usuarioId="ator" empresa={empresa} cliente={cliente} interceptada={interceptada} contatos={[]} />))
}
async function montar(interceptada = false) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await renderizar(true, interceptada)
}
async function popstate(){await act(async()=>{window.dispatchEvent(new PopStateEvent('popstate'));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))})}
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(x=>x.textContent===nome);expect(b).toBeDefined();await act(async()=>b!.click())}
async function preencher(name:string,value:string){const input=document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
test('formulário lateral mantém campos montados sob confirmações centrais e restaura o foco', async () => {
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  await montar()
  const ficha = document.querySelector('[data-painel-lateral]')
  await clicar('Registrar venda')

  const painel = document.querySelector('[data-painel-lateral]')!
  expect(painel).not.toBeNull()
  const form = painel.querySelector('form')!
  const valor = form.querySelector<HTMLInputElement>('input[name="valor"]')!
  const rodape = painel.querySelector('[data-painel-rodape]')!
  const conferir = rodape.querySelector<HTMLButtonElement>('button[type="submit"]')!
  const cancelar = [...rodape.querySelectorAll('button')].find(botao => botao.textContent === 'Cancelar')!
  const confirmacao = () => document.querySelector('[data-slot="dialog-content"]')
  expect(conferir.form).toBe(form)
  await clicar('Conferir venda')
  expect(confirmacao()).toBeNull()

  await preencher('valor', '125,50')
  await preencher('data', '2026-01-01')
  conferir.focus()
  await clicar('Conferir venda')
  expect(confirmacao()?.textContent).toContain('Confirmar venda')
  expect(painel.contains(confirmacao())).toBe(false)
  expect(document.activeElement?.textContent).toBe('Corrigir dados')
  expect(painel.querySelector('form')).toBe(form)
  await clicar('Corrigir dados')
  await vi.waitFor(() => expect(document.activeElement).toBe(conferir))

  cancelar.focus()
  await clicar('Cancelar')
  expect(confirmacao()?.textContent).toContain('Descartar alterações?')
  expect(document.activeElement?.textContent).toBe('Continuar editando')
  expect(painel.querySelector('form')).toBe(form)
  await clicar('Continuar editando')
  await vi.waitFor(() => expect(document.activeElement).toBe(cancelar))
  expect(form.querySelector('input[name="valor"]')).toBe(valor)
  expect(valor.value).toBe('125,50')

  await clicar('Cancelar')
  await clicar('Descartar')
  expect(voltar).toHaveBeenCalledOnce()
  await popstate()
  expect(document.querySelector('[data-painel-lateral]')).toBe(ficha)
  expect(ficha?.querySelector('form')).toBeNull()
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Registrar venda'))
  expect(mocks.venda).not.toHaveBeenCalled()
})

test('corrigir dados devolve foco ao campo ativo quando o formulário é conferido por Enter', async () => {
  await montar()
  await clicar('Registrar venda')
  await preencher('valor', '125,50')
  await preencher('data', '2026-01-01')
  const painel = document.querySelector('[data-painel-lateral]')!
  const valor = painel.querySelector<HTMLInputElement>('input[name="valor"]')!
  const conferir = painel.querySelector<HTMLButtonElement>('[data-painel-rodape] button[type=submit]')!
  valor.focus()
  await act(async () => conferir.form!.requestSubmit(conferir))
  expect(document.activeElement?.textContent).toBe('Corrigir dados')

  await clicar('Corrigir dados')
  await vi.waitFor(() => expect(document.activeElement).toBe(valor))
  expect(valor.value).toBe('125,50')
})

test('venda pede confirmação, preserva rascunho e repete a mesma chave após falha de rede',async()=>{
  await montar()
  await clicar('Registrar venda');await preencher('valor','125,50');await preencher('data','2026-01-01')
  await clicar('Cancelar');expect(document.body.textContent).toContain('Descartar alterações?');await clicar('Continuar editando')
  expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('125,50')
  await clicar('Conferir venda');expect(mocks.venda).not.toHaveBeenCalled()
  mocks.venda.mockRejectedValueOnce(new Error('rede'));await clicar('Confirmar venda')
  expect(document.body.textContent).toContain('Confirme o envio anterior com os mesmos dados')
  mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
  expect(mocks.venda).toHaveBeenCalledTimes(2)
  const [a,b]=mocks.venda.mock.calls.map(([f])=>f as FormData)
  expect(a.get('chave')).toMatch(/^[0-9a-f-]{36}$/);expect(b.get('chave')).toBe(a.get('chave'))
  await popstate()
  expect(b.get('valor')).toBe('125,50');expect(mocks.refresh).toHaveBeenCalledOnce()
})

test.each(['Retome o atendimento','O atendimento mudou'])('recusa %s preserva dados e chave até nova intenção',async erro=>{
 await montar()
 await clicar('Registrar venda');await preencher('valor','125,50');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:false,erro});await clicar('Confirmar venda')
 expect(document.body.textContent).toContain(erro)
 expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('125,50')
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
 const [a,b]=mocks.venda.mock.calls.map(([f])=>f as FormData)
 expect([...b.entries()]).toEqual([...a.entries()])
})

test('fechar recompra sem resposta volta à seção de origem e foca a confirmação do envio anterior', async () => {
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await montar()
  await clicar('Histórico')
  await clicar('Registrar venda')
  await preencher('valor', '128,50')
  await preencher('data', '2026-01-01')
  await clicar('Conferir venda')
  mocks.venda.mockRejectedValueOnce(new Error('rede'))
  await clicar('Confirmar venda')
  const envio = sessionStorage.getItem('crm:venda:v1:ator')
  const manter = [...document.querySelectorAll('button')].find(botao => botao.textContent === 'Fechar mantendo envio')!
  manter.focus()

  await clicar('Fechar mantendo envio')
  await popstate()

  const lateral = document.querySelector('[data-painel-lateral]')!
  const recuperar = [...lateral.querySelectorAll('button')].find(botao => botao.textContent === 'Confirmar venda anterior')
  expect(document.querySelector('[data-slot=dialog-content]')).toBeNull()
  expect(lateral.querySelector('h3')?.textContent).toBe('Histórico')
  expect(recuperar).toBeDefined()
  await vi.waitFor(() => expect(document.activeElement).toBe(recuperar))
  expect(sessionStorage.getItem('crm:venda:v1:ator')).toBe(envio)
  expect(mocks.venda).toHaveBeenCalledOnce()
})

test('recompra perdida recupera fora do modal após reload e mantém contexto sem corrigir entrada incerta',async()=>{
 await montar()
 await clicar('Registrar venda');await preencher('valor','128,50');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockRejectedValueOnce(Error('rede'));await clicar('Confirmar venda')
 expect([...document.querySelectorAll('button')].some(b=>b.textContent==='Corrigir dados')).toBe(false)
 const original=mocks.venda.mock.calls[0][0] as FormData
 await act(async()=>root!.unmount());host!.remove()
 await montar()
 expect(document.querySelector('[data-slot=dialog-content]')).toBeNull();expect(mocks.venda).toHaveBeenCalledTimes(1)
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda anterior')
 expect([...mocks.venda.mock.calls[1][0].entries()]).toEqual([...original.entries()])
 await vi.waitFor(() => expect(document.body.textContent).toContain('Venda registrada.'))
 expect(mocks.refresh).toHaveBeenCalledOnce()
})
test('nova recompra após sucesso é intenção nova com chave nova e guardas rearmadas',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 await montar()
 mocks.venda.mockResolvedValue({ok:true})
 await clicar('Registrar venda');await preencher('valor','25,50');await preencher('data','2026-01-01');await clicar('Conferir venda');await clicar('Confirmar venda')
 await popstate()
 await clicar('Registrar venda');await preencher('valor','81,50');await preencher('data','2026-01-02');await clicar('Conferir venda');await clicar('Confirmar venda')
 expect(mocks.venda).toHaveBeenCalledTimes(2)
 expect(mocks.venda.mock.calls[1][0].get('chave')).not.toBe(mocks.venda.mock.calls[0][0].get('chave'))
 await popstate()
 expect(document.querySelector('[data-slot=dialog-content]')).toBeNull()
})
test('validação da primeira tentativa conserva campos e permite corrigir com nova chave',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 await montar()
 await clicar('Registrar venda');await preencher('valor','abc');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:false,erro:'Confira o valor',erroDeCampos:true});await clicar('Confirmar venda')
 expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('abc')
 await clicar('Corrigir dados');await preencher('valor','81,50');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda');await popstate()
 expect(mocks.venda.mock.calls[1][0].get('chave')).not.toBe(mocks.venda.mock.calls[0][0].get('chave'))
 expect(mocks.refresh).toHaveBeenCalledOnce()
})

test('envio em voo impede saída e pode confirmar a mesma recompra depois de perder a elegibilidade', async () => {
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await montar()
  const ficha = document.querySelector('[data-painel-lateral]')
  await clicar('Registrar venda')
  await preencher('valor', '125,50')
  await preencher('data', '2026-01-01')
  await clicar('Conferir venda')
  let responder!: (valor: EstadoVenda) => void
  mocks.venda.mockImplementationOnce(() => new Promise<EstadoVenda>(resolve => { responder = resolve }))
  await clicar('Confirmar venda')
  await renderizar(false)
  await popstate()
  expect(document.querySelector('[data-painel-lateral]')).toBe(ficha)
  expect(document.querySelector('[data-slot=dialog-content]')?.textContent).toContain('Registrando...')
  expect(mocks.back).not.toHaveBeenCalled()
  await act(async () => responder({ ok: false, erro: 'Confirme o envio anterior.' }))
  mocks.venda.mockResolvedValueOnce({ ok: true })
  await clicar('Confirmar venda')
  const [original, replay] = mocks.venda.mock.calls.map(([form]) => [...form.entries()])
  expect(replay).toEqual(original)
  await popstate()
  expect(document.querySelector('[data-slot=dialog-content]')).toBeNull()
  expect(document.querySelector('[data-painel-lateral]')).toBeNull()
  expect(document.body.textContent).toContain('Venda registrada.')
})

test('replay de primeira venda mantém a entrada original e abre o destino autorizado', async () => {
  sessionStorage.setItem('crm:venda:v1:ator', JSON.stringify({
    usuarioId: 'ator', empresaId: 'outra-empresa', chave: 'chave-anterior',
    alvo: { tipo: 'primeira', negociacaoId: 'negociacao-anterior' },
    entrada: { valor: '425,50', data: '2026-01-01', observacao: 'Observação de outra empresa' },
  }))
  await montar(true)
  expect(document.body.textContent).not.toContain('425,50')
  expect(document.body.textContent).not.toContain('Observação de outra empresa')
  mocks.primeira.mockResolvedValueOnce({ ok: true, leituraDestino: { ok: true, destino: { tipo: 'carteira', empresaId: 'destino' } } })
  vi.spyOn(history, 'back').mockImplementation(() => {})
  await clicar('Confirmar venda anterior')
  await popstate()
  expect(mocks.primeira.mock.calls[0][0].get('id')).toBe('negociacao-anterior')
  expect(mocks.primeira.mock.calls[0][0].get('chave')).toBe('chave-anterior')
  expect(mocks.replace).toHaveBeenCalledWith('/carteira/destino?venda=registrada')
})

test.each([true, false])('reload com marca da entrada volta somente se a entrada anterior for a mesma ficha (%s)', async duplicada => {
  history.replaceState({ __NA: true }, '', '/carteira/empresa')
  const href = location.href
  const entrada = { index: 1, url: href, key: 'entrada-do-navegador' }
  sessionStorage.setItem('crm:carteira:entrada-edicao', JSON.stringify({ entrada: entrada.key, id: 'sentinela' }))
  vi.stubGlobal('navigation', {
    currentEntry: entrada,
    entries: () => [{ url: duplicada ? href : new URL('/meu-dia', href).href }, entrada],
  })
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  await montar()
  expect(voltar).toHaveBeenCalledTimes(duplicada ? 1 : 0)
})
