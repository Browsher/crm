// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const push=vi.fn()
vi.mock('next/navigation',()=>({useRouter:()=>({push})}))
vi.mock('./reservar',()=>({Reservar:()=> <button>Reservar para ligar</button>}))
import { LocalizarPessoal } from './pessoal'
const dados={empresas:[],total:0,nichos:['Armarinhos','Brinquedos'],bairros:['Brás · São Paulo/SP']}
const limpar:(()=>void)[]=[]
afterEach(()=>{limpar.splice(0).forEach(f=>f());push.mockClear()})
async function montar(){
  const div=document.createElement('div');document.body.append(div)
  const root=createRoot(div)
  await act(async()=>root.render(<LocalizarPessoal filtros={{origem:'google'}} dados={dados} recolhido={false}/>))
  limpar.push(()=>{act(()=>root.unmount());div.remove()})
  return div
}
test('Enter/submissão recolhe filtros, mantém origem e permite reabrir',async()=>{
  const div=await montar()
  const form=div.querySelector('form')!
  await act(async()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
  expect(form.hidden).toBe(true)
  expect(push).toHaveBeenCalledWith(expect.stringContaining('origem=google'),{scroll:false})
  expect(push.mock.calls[0][0]).toContain('pesquisado=1')
  const editar=[...div.querySelectorAll('button')].find(b=>b.textContent==='Editar filtros')!
  await act(async()=>editar.click())
  expect(form.hidden).toBe(false)
})
test('nicho limpa o bairro anterior ao consultar opções dependentes',async()=>{
  const div=await montar()
  const nicho=div.querySelector<HTMLSelectElement>('select[name=nicho]')!
  const endereco=div.querySelector<HTMLSelectElement>('select[name=endereco]')!
  endereco.value='Brás · São Paulo/SP'
  nicho.value='Brinquedos'
  await act(async()=>nicho.dispatchEvent(new Event('change',{bubbles:true})))
  expect(push.mock.calls[0][0]).toContain('nicho=Brinquedos')
  expect(push.mock.calls[0][0]).not.toContain('endereco=')
})
