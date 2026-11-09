// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({venda:vi.fn(),refresh:vi.fn()}))
vi.mock('./venda-acao',()=>({vendaCarteiraAcao:mocks.venda}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:mocks.refresh})}))
vi.mock('@/src/components/crm/tema',()=>({useTemaCrm:()=> 'light'}))
import { RegistrarVenda } from './registrar-venda'
let root:ReturnType<typeof createRoot>|undefined,host:HTMLDivElement|undefined
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();sessionStorage.clear();vi.clearAllMocks();vi.restoreAllMocks()})
async function popstate(){await act(async()=>{window.dispatchEvent(new PopStateEvent('popstate'));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))})}
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(x=>x.textContent===nome);expect(b).toBeDefined();await act(async()=>b!.click())}
async function preencher(name:string,value:string){const input=document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
test('formulário lateral mantém campos montados sob confirmações centrais e restaura o foco', async () => {
  const voltar = vi.spyOn(history, 'back').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
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
  expect(document.querySelector('[data-painel-lateral]')).toBeNull()
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Registrar venda'))
  expect(mocks.venda).not.toHaveBeenCalled()
})
test('venda pede confirmação, preserva rascunho e repete a mesma chave após falha de rede',async()=>{
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
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
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
 await clicar('Registrar venda');await preencher('valor','125,50');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:false,erro});await clicar('Confirmar venda')
 expect(document.body.textContent).toContain(erro)
 expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('125,50')
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
 const [a,b]=mocks.venda.mock.calls.map(([f])=>f as FormData)
 expect([...b.entries()]).toEqual([...a.entries()])
})

test('recompra perdida recupera fora do modal após reload e mantém contexto sem corrigir entrada incerta',async()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
 await clicar('Registrar venda');await preencher('valor','128,50');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockRejectedValueOnce(Error('rede'));await clicar('Confirmar venda')
 expect([...document.querySelectorAll('button')].some(b=>b.textContent==='Corrigir dados')).toBe(false)
 const original=mocks.venda.mock.calls[0][0] as FormData
 await act(async()=>root!.unmount());host.remove();host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
 expect(document.querySelector('[role=dialog]')).toBeNull();expect(mocks.venda).toHaveBeenCalledTimes(1)
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda anterior')
 expect([...mocks.venda.mock.calls[1][0].entries()]).toEqual([...original.entries()])
 expect(document.body.textContent).toContain('Venda registrada.');expect(mocks.refresh).toHaveBeenCalledOnce()
})
test('nova recompra após sucesso é intenção nova com chave nova e guardas rearmadas',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
 mocks.venda.mockResolvedValue({ok:true})
 await clicar('Registrar venda');await preencher('valor','25,50');await preencher('data','2026-01-01');await clicar('Conferir venda');await clicar('Confirmar venda')
 await popstate()
 await clicar('Registrar venda');await preencher('valor','81,50');await preencher('data','2026-01-02');await clicar('Conferir venda');await clicar('Confirmar venda')
 expect(mocks.venda).toHaveBeenCalledTimes(2)
 expect(mocks.venda.mock.calls[1][0].get('chave')).not.toBe(mocks.venda.mock.calls[0][0].get('chave'))
 await popstate()
 expect(document.querySelector('[role=dialog]')).toBeNull()
})
test('validação da primeira tentativa conserva campos e permite corrigir com nova chave',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root!.render(<RegistrarVenda usuarioId="ator" empresaId="empresa" nome="Aurora" />))
 await clicar('Registrar venda');await preencher('valor','abc');await preencher('data','2026-01-01');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:false,erro:'Confira o valor',erroDeCampos:true});await clicar('Confirmar venda')
 expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('abc')
 await clicar('Corrigir dados');await preencher('valor','81,50');await clicar('Conferir venda')
 mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda');await popstate()
 expect(mocks.venda.mock.calls[1][0].get('chave')).not.toBe(mocks.venda.mock.calls[0][0].get('chave'))
 expect(mocks.refresh).toHaveBeenCalledOnce()
})
