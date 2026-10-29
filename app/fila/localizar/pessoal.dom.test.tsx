// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const push=vi.fn()
vi.mock('next/navigation',()=>({useRouter:()=>({push})}))
vi.mock('./reservar',()=>({Reservar:()=> <button>Reservar para ligar</button>}))
import { LocalizarPessoal } from './pessoal'
import type { EmpresaPessoal, FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
const dados={empresas:[],total:0,nichos:['Armarinhos','Brinquedos'],bairros:['Brás · São Paulo/SP']}
const limpar:(()=>void)[]=[]
afterEach(()=>{limpar.splice(0).forEach(f=>f());push.mockClear()})
async function montar(filtros:FiltrosPessoais={origem:'google'},empresas:EmpresaPessoal[]=[],recolhido=false){
  const div=document.createElement('div');document.body.append(div)
  const root=createRoot(div)
  await act(async()=>root.render(<LocalizarPessoal filtros={filtros} dados={{...dados,empresas,total:empresas.length}} recolhido={recolhido}/>))
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

test('perfil e continuação preservam filtros pessoais e a página da consulta',async()=>{
  const filtros={origem:'google',nicho:'Brinquedos',pagina:'2'}
  const empresa:EmpresaPessoal={id:'00000000-0000-4000-8000-000000000123',nome:'Minha empresa',cnpj:null,cnae:null,cep:null,porte:null,abertura:null,bairro:null,cidade:null,uf:null,origens:['google'],nichos:['Brinquedos'],regioes:[],entrada:'2026-10-23T12:00:00Z',situacao:'reservada'}
  const div=await montar(filtros,[empresa])
  for(const nome of ['Ver empresa','Continuar atendimento']) {
    const link=[...div.querySelectorAll('a')].find(a=>a.textContent===nome)!
    const url=new URL(link.getAttribute('href')!,'http://localhost')
    expect(url.searchParams.get('pagina')).toBe('2')
    expect(JSON.parse(url.searchParams.get('pessoal')!)).toEqual(filtros)
    expect(url.searchParams.has('grupo')).toBe(false)
    expect(url.pathname).toBe(nome==='Ver empresa'?`/fila/localizar/${empresa.id}`:'/fila')
  }
})


test('resultado vazio explica a pesquisa e oferece editar filtros como ação local',async()=>{
  const div=await montar({origem:'google'},[],true)
  expect(div.querySelector('form')!.hidden).toBe(true)
  const titulo=[...div.querySelectorAll('h3')].find(h=>h.textContent==='Nenhuma empresa com esses filtros')
  expect(titulo).toBeDefined()
  const card=titulo!.closest('[data-slot="card"]')!
  expect(card.textContent).toContain('Edite os filtros ou busque novas empresas na Prospecção.')
  const editar=[...card.querySelectorAll('button')].find(b=>b.textContent==='Editar filtros')!
  expect(editar).toBeDefined()
  expect(editar.type).toBe('button')
  await act(async()=>editar.click())
  expect(div.querySelector('form')!.hidden).toBe(false)
})
