// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { CardSemInteresse } from './card-sem-interesse'
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove()})
test('consulta por link e drop autorizado são independentes',async()=>{
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 const soltar=vi.fn(),sobre=vi.fn()
 await act(async()=>root.render(<CardSemInteresse estado="repouso" total={23} aceitaArraste={false} aoMudarSobre={sobre} aoSoltar={soltar}/>))
 const alvo=host.querySelector('[data-descarte]')!
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/fila/sem-interesse')
 expect(host.textContent).toContain('23')
 await act(async()=>alvo.dispatchEvent(new Event('drop',{bubbles:true,cancelable:true})))
 expect(soltar).not.toHaveBeenCalled()
 await act(async()=>root.render(<CardSemInteresse estado="sobre" total={23} aceitaArraste aoMudarSobre={sobre} aoSoltar={soltar}/>))
 await act(async()=>alvo.dispatchEvent(new Event('drop',{bubbles:true,cancelable:true})))
 expect(soltar).toHaveBeenCalledTimes(1)
 expect(host.querySelectorAll('a')).toHaveLength(1)
})
