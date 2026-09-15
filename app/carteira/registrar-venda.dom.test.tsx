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
afterEach(async()=>{await act(async()=>root?.unmount());host?.remove();vi.clearAllMocks()})
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(x=>x.textContent===nome);expect(b).toBeDefined();await act(async()=>b!.click())}
async function preencher(name:string,value:string){const input=document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))})}
test('venda pede confirmação, preserva rascunho e repete a mesma chave após falha de rede',async()=>{
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root!.render(<RegistrarVenda empresaId="empresa" nome="Aurora" />))
  await clicar('Registrar venda');await preencher('valor','125,50');await preencher('data','2026-01-01')
  await clicar('Cancelar');expect(document.body.textContent).toContain('Descartar alterações?');await clicar('Continuar editando')
  expect(document.querySelector<HTMLInputElement>('input[name="valor"]')!.value).toBe('125,50')
  await clicar('Conferir venda');expect(mocks.venda).not.toHaveBeenCalled()
  mocks.venda.mockRejectedValueOnce(new Error('rede'));await clicar('Confirmar venda')
  expect(document.body.textContent).toContain('Tente novamente com os mesmos dados')
  mocks.venda.mockResolvedValueOnce({ok:true});await clicar('Confirmar venda')
  expect(mocks.venda).toHaveBeenCalledTimes(2)
  const [a,b]=mocks.venda.mock.calls.map(([f])=>f as FormData)
  expect(a.get('chave')).toMatch(/^[0-9a-f-]{36}$/);expect(b.get('chave')).toBe(a.get('chave'))
  expect(b.get('valor')).toBe('125,50');expect(mocks.refresh).toHaveBeenCalledOnce()
})
