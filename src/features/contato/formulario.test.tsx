// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
const gravar = vi.hoisted(() => vi.fn())
const preparar = vi.hoisted(() => vi.fn())
const refresh = vi.hoisted(() => vi.fn())
vi.mock('./acao', () => ({ registrarContatoAcao: gravar, prepararContatoAcao: preparar }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
import { FormularioContato } from './formulario'
import { descartarRascunhoContato, rascunhoInicial } from './rascunho'
let root: ReturnType<typeof createRoot>, host: HTMLDivElement
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); preparar.mockResolvedValue({ ok:true, fase:'inicial', empresa:{versao:8,situacao:'atendimento'} }); host=document.createElement('div');document.body.append(host);root=createRoot(host) })
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function montar(id='A', versao=2) { await act(async()=>root.render(<FormularioContato empresaId={id} versao={versao} fase="inicial" />)) }
async function nota(texto:string) { await act(async()=>{ const campo=host.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(campo,texto);campo.dispatchEvent(new Event('input',{bubbles:true})) }) }
async function enviar() { await act(async()=>host.querySelector('form')!.requestSubmit()) }
test('DTO próprio indisponível sem envio não habilita comando novo no editor preparado',async()=>{
  preparar.mockResolvedValue({ok:true,fase:'inicial',empresa:{situacao:'indisponivel',versao:10}})
  await act(async()=>root.render(<FormularioContato empresaId="A" />))
  expect(host.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true)
  await enviar()
  expect(gravar).not.toHaveBeenCalled()
})
test('preparação indisponível e recusa temporária de auth preservam replay desconhecido até nova tentativa',async()=>{
  gravar.mockRejectedValueOnce(new Error('Resposta perdida'))
  await montar();await nota('Original');await enviar()
  const primeiro=Object.fromEntries(gravar.mock.calls[0][1])
  await act(async()=>root.render(null))
  preparar.mockResolvedValue({ok:false,motivo:'sem_permissao'})
  await act(async()=>root.render(<FormularioContato empresaId="A" />))
  gravar.mockResolvedValueOnce({ok:false,motivo:'sem_permissao',erro:'Acesso indisponível'})
  await enviar()
  expect(gravar).toHaveBeenCalledTimes(2)
  expect(Object.fromEntries(gravar.mock.calls[1][1])).toEqual(primeiro)
  const guardado=JSON.parse(sessionStorage.getItem('crm:contato:v1:A')!)
  expect(guardado.envio.resolvido).not.toBe(true)
  expect(host.textContent).not.toContain('Atualizar atendimento para novo envio')
  expect(host.querySelector('textarea')!.value).toBe('Original')
  expect(descartarRascunhoContato('A')).toBe(false)
  gravar.mockResolvedValueOnce({ok:true,repetida:true,erro:null})
  await enviar()
  expect(Object.fromEntries(gravar.mock.calls[2][1])).toEqual(primeiro)
  expect(sessionStorage.getItem('crm:contato:v1:A')).toBeNull()
})
test('restaura estado do consumidor mesmo com callback recriado a cada render',async()=>{
  const valor={...rascunhoInicial(false),nota:'Restaurada'}
  sessionStorage.setItem('crm:contato:v1:A',JSON.stringify({valor,envio:null}))
  let avisos=0
  function Consumidor(){const[draft,setDraft]=useState(rascunhoInicial(false));return <><p data-draft>{draft.nota}</p><FormularioContato empresaId="A" versao={2} fase="inicial" rascunho={draft} onDraftChange={v=>{avisos++;if(avisos>3)throw new Error('Ciclo de restauração');setDraft(v)}} /></>}
  await act(async()=>root.render(<Consumidor/>))
  expect(host.querySelector('[data-draft]')!.textContent).toBe('Restaurada')
  expect(avisos).toBe(1)
})
test('descarte explícito sem envio limpa store e editor; envio desconhecido bloqueia descarte',async()=>{
  await montar();await nota('Descartar')
  await act(async()=>{expect(descartarRascunhoContato('A')).toBe(true)})
  expect(sessionStorage.getItem('crm:contato:v1:A')).toBeNull()
  gravar.mockRejectedValueOnce(new Error('rede'));await enviar()
  const salvo=sessionStorage.getItem('crm:contato:v1:A')
  expect(descartarRascunhoContato('A')).toBe(false)
  expect(sessionStorage.getItem('crm:contato:v1:A')).toBe(salvo)
})
test('rascunhos separados sobrevivem troca de empresa e remontagem',async()=>{
  await montar('A');await nota('Nota A');await montar('B');await nota('Nota B')
  await montar('A');expect(host.querySelector('textarea')!.value).toBe('Nota A')
  await montar('B');expect(host.querySelector('textarea')!.value).toBe('Nota B')
  expect(gravar).not.toHaveBeenCalled()
})
test('resposta perdida mantém chave, versão e entrada após remount e replay limpa só após sucesso',async()=>{
  gravar.mockRejectedValueOnce(new Error('rede'))
  await montar();await nota('Preservar');await enviar()
  const primeiro=Object.fromEntries(gravar.mock.calls[0][1])
  expect(host.querySelector('textarea')!.value).toBe('Preservar')
  expect(host.querySelector('textarea')!.readOnly).toBe(true)
  await montar('B');await montar('A',9)
  gravar.mockResolvedValueOnce({ok:true,erro:null,repetida:true})
  await enviar()
  expect(Object.fromEntries(gravar.mock.calls[1][1])).toEqual(primeiro)
  expect(primeiro.versao).toBe('2')
  expect(host.querySelector('textarea')!.value).toBe('')
  expect(refresh).toHaveBeenCalled()
  await nota('Outro contato');gravar.mockResolvedValueOnce({ok:true,erro:null,repetida:false});await enviar()
  expect(gravar.mock.calls[2][1].get('chave')).not.toBe(primeiro.chave)
  expect(gravar.mock.calls[2][1].get('versao')).toBe('8')
})
test('conflito preserva texto e exige atualizar explicitamente antes de novo comando',async()=>{
  gravar.mockResolvedValueOnce({ok:false,erro:'Empresa desatualizada',motivo:'desatualizada'})
  await montar();await nota('Nota antiga');await enviar()
  expect(host.textContent).toContain('Empresa desatualizada')
  expect(host.querySelector('textarea')!.value).toBe('Nota antiga')
  const chave=gravar.mock.calls[0][1].get('chave')
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Atualizar atendimento para novo envio')!.click())
  gravar.mockResolvedValueOnce({ok:true,erro:null});await enviar()
  expect(gravar.mock.calls[1][1].get('chave')).not.toBe(chave)
  expect(gravar.mock.calls[1][1].get('versao')).toBe('8')
})
test('fase de preparação do servidor habilita acompanhamento sem posse enviada',async()=>{
  preparar.mockResolvedValueOnce({ok:true,fase:'cliente',empresa:{versao:10,situacao:'cliente'}})
  await act(async()=>root.render(<FormularioContato empresaId="cliente" posse={false} />))
  expect(host.querySelector('input[value=acompanhamento]')).not.toBeNull()
  expect(host.querySelectorAll('input[type=radio]')).toHaveLength(6)
  expect(host.querySelector('[name=posse]')).toBeNull()
  expect(host.querySelector('[name=desfecho]')).toBeNull()
  expect(host.textContent).not.toMatch(/30 dias|reserva|devolver/)
})
test.each([true,false])('arquivo após resposta perdida mantém confirmação do mesmo comando (rota direta %s)',async(direto)=>{
  const valor={tipo:'sem_interesse',nota:'Encerrar',proximoPasso:'',proximoPassoData:''}
  const comando={chave:'chave-original',versao:3,valor}
  sessionStorage.setItem('crm:contato:v1:A',JSON.stringify({valor,envio:comando}))
  gravar.mockResolvedValueOnce({ok:true,erro:null,repetida:true})
  preparar.mockResolvedValue({ok:true,fase:'inicial',empresa:{situacao:'sem_interesse',versao:4}})
  await act(async()=>root.render(<FormularioContato empresaId="A" {...(direto?{versao:4,fase:'inicial' as const,somenteConfirmacao:true}:{})} />))
  expect(host.textContent).toContain('Confirmar envio anterior')
  await enviar()
  expect(gravar.mock.calls[0][1].get('chave')).toBe('chave-original')
  expect(gravar.mock.calls[0][1].get('versao')).toBe('3')
  if(direto)expect(host.querySelector('form')).toBeNull()
  else expect(host.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true)
})
