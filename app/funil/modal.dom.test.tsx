// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ModalFunil } from './modal'
import { detalheAcao, vendaAcao, telefoneAcao, etapaAcao } from './acoes'
import { detalhesSnapshot } from '@/src/lib/empresa-visual'
vi.mock('./acoes',()=>({detalheAcao:vi.fn(),telefoneAcao:vi.fn(),etapaAcao:vi.fn(),vendaAcao:vi.fn(),devolverAcao:vi.fn()}))
vi.mock('@/src/features/contato/formulario',()=>({FormularioContato:({onDraftChange,onSaved}:{onDraftChange:(r:unknown)=>void;onSaved:(id:string,r:unknown)=>void})=><><button onClick={()=>onDraftChange({tipo:'acompanhamento',nota:'Preservar',proximoPasso:'',proximoPassoData:''})}>Editar rascunho de teste</button><button onClick={()=>onDraftChange({tipo:'acompanhamento',nota:'',proximoPasso:'',proximoPassoData:''})}>Reverter rascunho de teste</button><button onClick={()=>onSaved('e',{ok:true,leituraDestino:{ok:true,destino:{tipo:'funil',negociacaoId:'atual'}}})}>Confirmar contato de teste</button></>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
const detalhe={id:'a',empresaId:'e',nome:'Aurora',cidade:null,uf:null,cnpj:'123',etapa:'primeiro_contato' as const,versao:3,empresa:{...detalhesSnapshot({razao_social:'Aurora'},{tipo:'cadastro',empresaId:'e'}),id:'e',versao:3,situacao:'primeiro_contato' as const,negociacaoId:'a'},proximoPasso:null,retorno:null,historico:[]}
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();sessionStorage.clear();vi.restoreAllMocks()})
async function montar(id='a'){host=document.createElement('div');document.body.append(host);root=createRoot(host);const fechar=vi.fn();await act(async()=>root.render(<ModalFunil id={id} fechar={fechar}/>));return fechar}
async function clicar(nome:string){const b=[...document.querySelectorAll('button')].find(e=>e.textContent===nome||e.getAttribute('aria-label')===nome);expect(b, nome).toBeTruthy();await act(async()=>b!.click())}
async function escrever(valor:string){const e=document.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(e,valor);e.dispatchEvent(new Event('input',{bubbles:true}))})}

test('ação Sem interesse usa comando do quadro sem contato nem devolução; pendente não duplica',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 let liberar!:(r:{ok:boolean;repetida:boolean})=>void
 const arquivar=vi.fn(()=>new Promise<{ok:boolean;repetida:boolean}>(r=>liberar=r)),fechar=vi.fn()
 await act(async()=>root.render(<ModalFunil id="a" fechar={fechar} aoArquivar={arquivar}/>))
 await clicar('Marcar como Sem interesse');await clicar('Confirmar Sem interesse')
 expect(arquivar).toHaveBeenCalledTimes(1);expect(document.body.textContent).not.toContain('Devolver à prospecção')
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})))
 expect(arquivar).toHaveBeenCalledTimes(1);expect(fechar).not.toHaveBeenCalled()
 await act(async()=>liberar({ok:true,repetida:true}))
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(fechar).toHaveBeenCalledWith('Envio anterior confirmado. Confira a situação atual.')
})

test('envio desconhecido do quadro bloqueia nova operação no modal do deep-link',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<ModalFunil id="a" fechar={vi.fn()} bloqueada/>))
 await clicar('Registrar venda')
 expect(document.querySelector('input')).toBeNull()
 expect(document.body.textContent).toContain('Confirme o envio anterior no Funil')
})

test('confirmação histórica cujo estado atual mudou não anuncia empresa arquivada',async()=>{
 vi.spyOn(history,'back').mockImplementation(()=>{})
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 const fechar=vi.fn()
 await act(async()=>root.render(<ModalFunil id="a" fechar={fechar} aoArquivar={async()=>({ok:true,repetida:false,atual:false})}/>))
 await clicar('Marcar como Sem interesse');await clicar('Confirmar Sem interesse')
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(fechar).toHaveBeenCalledWith('Operação confirmada. Confira a situação atual da empresa.')
})

test('descarte externo não perde envio desconhecido e permite fechar mantendo sessão',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const salvo=JSON.stringify({envio:{chave:'original',versao:2,valor:{nota:'Preservar'}}})
  sessionStorage.setItem('crm:contato:v1:e',salvo)
  const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste');await clicar('Voltar ao resumo');await clicar('Descartar')
  expect(document.body.textContent).toContain('Confirme o envio anterior')
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
  await clicar('Fechar mantendo rascunho')
  await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
  expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
  expect(fechar).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('Etapa atual:')
})

test('modal oferece apenas próximo avanço e última etapa não tem select nem avanço',async()=>{
  vi.mocked(detalheAcao).mockResolvedValue(detalhe)
  vi.mocked(etapaAcao).mockResolvedValue({ok:true})
  vi.spyOn(history,'back').mockImplementation(()=>{})
  const fechar=await montar()
  expect(document.querySelector('select')).toBeNull()
  await clicar('Avançar para Em negociação')
  await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
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

test('abas mostram histórico autorizado e mantêm a alternativa de avanço por botão', async () => {
  vi.mocked(detalheAcao).mockResolvedValue({ ...detalhe, historico: [{ id: 'contato', em: '2026-10-21T12:00:00Z', tipo: 'acompanhamento', nota: 'Negociar prazo com Aurora', proximoPasso: null, retorno: null }] })
  await montar()
  const historico = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')].find(b => b.textContent === 'Histórico')
  expect(historico).toBeTruthy()
  await act(async () => historico!.click())
  expect(document.querySelector('[role=tabpanel]:not([hidden])')?.textContent).toContain('Negociar prazo com Aurora')
  expect([...document.querySelectorAll('button')].some(b => b.textContent === 'Avançar para Em negociação')).toBe(true)
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

test('contato confirmado no modal conserva callback de fechamento contextual',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Confirmar contato de teste')
 expect(fechar).toHaveBeenCalledWith('Atendimento registrado.')
})
test('acompanhamento intocado do modal volta ao resumo sem descarte',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Voltar ao resumo')
 expect(document.body.textContent).not.toContain('Descartar alterações?')
 expect(document.body.textContent).toContain('Registrar venda')
 expect(fechar).not.toHaveBeenCalled()
})

test('reverter ao baseline remove proteção temporária do histórico do modal',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste')
 expect(voltar).toHaveBeenCalledTimes(1)
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(document.body.textContent).not.toContain('Descartar alterações?')
 expect(fechar).not.toHaveBeenCalled()
})

test('fechamento após contato aguarda popstate da sentinela e só então chama o Quadro',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste')
 await clicar('Confirmar contato de teste')
 expect(voltar).toHaveBeenCalledTimes(1)
 expect(fechar).not.toHaveBeenCalled()
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(fechar).toHaveBeenCalledTimes(1)
 expect(fechar).toHaveBeenCalledWith('Atendimento registrado.')
})
test('Escape durante retirada por reversão aguarda a mesma navegação sem recuar duas vezes',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste')
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
 expect(voltar).toHaveBeenCalledTimes(1);expect(fechar).not.toHaveBeenCalled()
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).toHaveBeenCalledTimes(1)
})
test('Escape intocado fecha imediatamente sem recuo de histórico',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe)
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar()
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).not.toHaveBeenCalled()
})

test('X intocado fecha sem sentinela e Voltar ao resumo não navega',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Voltar ao resumo')
 expect(fechar).not.toHaveBeenCalled();expect(voltar).not.toHaveBeenCalled()
 await clicar('Fechar')
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).not.toHaveBeenCalled()
})
test.each(['Fechar','Escape'])('fechar com %s preserva comando desconhecido e aguarda só um recuo',async(como)=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{})
 const valor={tipo:'acompanhamento',nota:'',proximoPasso:'',proximoPassoData:''}
 const salvo=JSON.stringify({valor,envio:{chave:'anterior',versao:2,valor}})
 sessionStorage.setItem('crm:contato:v1:e',salvo)
 const fechar=await montar();await clicar('Registrar atendimento')
 if(como==='Escape')await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})))
 else await clicar('Fechar')
 await clicar('Fechar mantendo rascunho')
 expect(fechar).not.toHaveBeenCalled();expect(voltar).toHaveBeenCalledTimes(1)
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(fechar).toHaveBeenCalledTimes(1);expect(voltar).toHaveBeenCalledTimes(1)
 expect(sessionStorage.getItem('crm:contato:v1:e')).toBe(salvo)
})
test('Voltar do navegador confirmado remove só a sentinela e a intenção original de voltar',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 const voltar=vi.spyOn(history,'back').mockImplementation(()=>{}),ir=vi.spyOn(history,'go').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste')
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 await clicar('Descartar')
 expect(ir).toHaveBeenCalledTimes(1);expect(ir).toHaveBeenCalledWith(-2)
 expect(voltar).not.toHaveBeenCalled();expect(fechar).not.toHaveBeenCalled()
})

test('nova edição enquanto a sentinela sai continua protegida no próximo Voltar',async()=>{
 vi.mocked(detalheAcao).mockResolvedValue(detalhe);vi.mocked(telefoneAcao).mockResolvedValue('11999999999')
 vi.spyOn(history,'back').mockImplementation(()=>{})
 const fechar=await montar();await clicar('Registrar atendimento');await clicar('Editar rascunho de teste');await clicar('Reverter rascunho de teste');await clicar('Editar rascunho de teste')
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 await act(async()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(document.body.textContent).toContain('Descartar alterações?')
 expect(fechar).not.toHaveBeenCalled()
})
