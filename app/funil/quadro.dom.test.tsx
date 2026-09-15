// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { Quadro } from './quadro'
import { etapaAcao } from './acoes'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('./acoes',()=>({etapaAcao:vi.fn()}))
vi.mock('./modal',()=>({ModalFunil:()=> <p>Perfil aberto</p>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.restoreAllMocks()})
async function montar(){
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root.render(<Quadro linhas={[{id:'a',empresaId:'e',nome:'Aurora',cidade:null,etapa:'primeiro_contato'}]} />))
}
async function evento(alvo:Element,tipo:string){const e=new Event(tipo,{bubbles:true,cancelable:true});Object.defineProperty(e,'dataTransfer',{value:{setData:vi.fn(),effectAllowed:'move'}});await act(async()=>{alvo.dispatchEvent(e)})}
test('arraste ignora salto, envia uma vez e restaura card quando falha',async()=>{
  await montar();const card=host.querySelector('button')!
  expect(card.draggable).toBe(true)
  const colunas=host.querySelectorAll('section')
  await evento(card,'dragstart');await evento(colunas[2],'drop');expect(etapaAcao).not.toHaveBeenCalled()
  let resolver!:(r:{ok:boolean;erro:string})=>void
  vi.mocked(etapaAcao).mockReturnValue(new Promise(r=>resolver=r))
  await evento(card,'dragstart');await evento(colunas[1],'drop')
  expect(colunas[1].textContent).toContain('Aurora')
  await evento(colunas[2],'drop');expect(etapaAcao).toHaveBeenCalledTimes(1)
  await act(async()=>resolver({ok:false,erro:'Falha simulada'}))
  expect(colunas[0].textContent).toContain('Aurora');expect(colunas[1].textContent).not.toContain('Aurora')
  expect(host.textContent).toContain('Falha simulada')
  await act(async()=>host.querySelector('button')!.click());expect(host.textContent).toContain('Perfil aberto')
})
