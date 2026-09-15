// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ModalFunil } from './modal'
import { detalheAcao, vendaAcao, telefoneAcao, etapaAcao } from './acoes'
vi.mock('./acoes',()=>({detalheAcao:vi.fn(),telefoneAcao:vi.fn(),etapaAcao:vi.fn(),vendaAcao:vi.fn(),devolverAcao:vi.fn()}))
vi.mock('@/src/features/contato/formulario',()=>({FormularioContato:()=>null}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
const detalhe={id:'a',empresaId:'e',nome:'Aurora',cidade:null,uf:null,cnpj:'123',etapa:'primeiro_contato' as const,proximoPasso:null,retorno:null,historico:[]}
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.restoreAllMocks()})
async function montar(id='a'){host=document.createElement('div');document.body.append(host);root=createRoot(host);const fechar=vi.fn();await act(async()=>root.render(<ModalFunil id={id} fechar={fechar}/>));return fechar}
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(e=>e.textContent===nome);expect(b, nome).toBeTruthy();await act(async()=>b!.click())}
async function escrever(valor:string){const e=document.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,valor);e.dispatchEvent(new Event('input',{bubbles:true}))})}

test('modal oferece apenas próximo avanço e última etapa não tem select nem avanço',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(etapaAcao).mockResolvedValue({ok:true})
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar()
  expect(document.querySelector('select')).toBeNull()
  await clicar('Avançar para Em negociação')
  const f=vi.mocked(etapaAcao).mock.calls.at(-1)![0]
  expect(f.get('etapa')).toBe('em_negociacao');expect(f.get('anterior')).toBe('primeiro_contato')
  expect(fechar).toHaveBeenCalledWith('Etapa atualizada.')
  await act(async()=>root.unmount());host.remove()
  vi.mocked(detalheAcao).mockResolvedValue({...detalhe,etapa:'proposta_enviada'})
  await montar('ultima')
  expect(document.querySelector('select')).toBeNull()
  expect(document.body.textContent).not.toContain('Avançar para')
  expect(document.body.textContent).toContain('Registrar venda')
})
test('resposta tardia após desmontagem não apresenta dados em outra abertura',async()=>{
  let liberar!:(d:typeof detalhe)=>void
  vi.mocked(detalheAcao).mockReturnValueOnce(new Promise(r=>liberar=r))
  await montar();expect(document.body.textContent).toContain('Carregando negociação')
  await act(async()=>root.unmount());host.remove()
  vi.mocked(detalheAcao).mockResolvedValueOnce({...detalhe,id:'b',nome:'Boreal'})
  await montar('b');await act(async()=>liberar(detalhe))
  expect(document.body.textContent).toContain('Boreal');expect(document.body.textContent).not.toContain('Aurora')
})
test('rascunho sobrevive ao Escape e erro de venda; envio bloqueia fechamento',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar();await clicar('Registrar venda');await escrever('25,00')
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
  expect(document.body.textContent).toContain('Descartar alterações?');await clicar('Continuar editando');expect(document.querySelector('input')?.value).toBe('25,00')
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  let liberar!:(r:{ok:boolean;erro:string})=>void
  vi.mocked(vendaAcao).mockReturnValueOnce(new Promise(r=>liberar=r))
  await clicar('Confirmar venda')
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
  expect(fechar).not.toHaveBeenCalled()
  await act(async()=>liberar({ok:false,erro:'Falha simulada'}))
  expect(document.body.textContent).toContain('Falha simulada');expect(document.querySelector('input')?.value).toBe('25,00')
  expect(vi.mocked(vendaAcao).mock.calls[0][0].get('chave')).toMatch(/^[0-9a-f-]{36}$/)
})
test('perda de posse bloqueia escrita mas preserva rascunho para copiar',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar();await clicar('Registrar venda');await escrever('32,10')
  await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  vi.mocked(vendaAcao).mockResolvedValue({ok:false,erro:'Indisponível',indisponivel:true});await clicar('Confirmar venda')
  expect(fechar).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Rascunho preservado')
  expect(document.querySelector('textarea')?.value).toContain('32,10')
})
test('resposta antiga do telefone não fecha novo formulário de venda',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.spyOn(history,'back').mockImplementation(()=>{})
  let liberar!:(t:string|null)=>void;vi.mocked(telefoneAcao).mockReturnValue(new Promise(r=>liberar=r))
  const fechar=await montar();await clicar('Registrar atendimento');await clicar('Voltar ao resumo');await clicar('Registrar venda');await escrever('40,00')
  await act(async()=>liberar(null));expect(fechar).not.toHaveBeenCalled();expect(document.querySelector('input')?.value).toBe('40,00')
})
