// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { RascunhosProvider } from './rascunhos'
const mocks=vi.hoisted(()=>({reserva:vi.fn(),acao:vi.fn(),grupo:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/features/fila/consulta',()=>({lerMinhasEmpresas:mocks.reserva}))
vi.mock('@/src/features/contato/historico',()=>({lerHistorico:async()=>({ok:true,contatos:[]})}))
vi.mock('@/src/server/grupos/prospeccao',()=>({lerGrupoProspeccao:mocks.grupo}))
vi.mock('./acoes',()=>({agirNaFilaAcao:mocks.acao}))
vi.mock('@/src/features/contato/acao',()=>({registrarContatoAcao:vi.fn()}))
vi.mock('./localizar/registrar-visita',()=>({RegistrarVisita:()=>null}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
import Pagina from './page'

test('trocar só grupo e abrir escolha mantém editor, reserva e nota digitada',async()=>{
  const empresa={id:'00000000-0000-4000-8000-000000000001',cnpj:null,razaoSocial:'Cliente atual',nomeFantasia:null,contatoNome:null,telefone:'11987654321',email:null,cep:null,endereco:null,reservadoAte:new Date('2099-01-01'),situacaoRetorno:'sem_data',cnaePrincipal:null,ultimoContato:null,posse:false,proximoPasso:null,proximoPassoData:null,vencido:false}
  mocks.reserva.mockResolvedValue({ok:true,reserva:empresa,contexto:'versao'})
  mocks.grupo.mockImplementation(async (_usuario:string,id:string)=>({ok:true,grupo:{id,nome:`Lista ${id}`,descricao:null,origem:null,criterios:null,criadoEm:'2026-10-13',total:2,disponiveis:1}}))
  const grupo1='00000000-0000-4000-8000-000000000701'
  const grupo2='00000000-0000-4000-8000-000000000702'
  const host=document.createElement('div');document.body.append(host)
  const root=createRoot(host)
  async function mostrar(params:Record<string,string>) {
    const pagina=await Pagina({searchParams:Promise.resolve(params)})
    await act(async()=>root.render(<RascunhosProvider>{pagina}</RascunhosProvider>))
  }
  try {
    await mostrar({grupo:grupo1})
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Registrar resultado')!.click())
    const nota=host.querySelector<HTMLTextAreaElement>('textarea[name="nota"]')!
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(nota,'Nota digitada durante atendimento')
      nota.dispatchEvent(new Event('input',{bubbles:true}))
    })
    expect(nota.value).toBe('Nota digitada durante atendimento')
    await mostrar({grupo:grupo1,escolher_lista:'1'})
    expect(host.querySelector('textarea[name="nota"]')).toBe(nota)
    expect(host.querySelector('[data-escolher-lista]')?.getAttribute('data-escolher-lista')).toBe('aberto')
    await mostrar({grupo:grupo2})
    expect(host.querySelector('textarea[name="nota"]')).toBe(nota)
    expect(nota.value).toBe('Nota digitada durante atendimento')
    expect(host.textContent).toContain('Cliente atual')
    expect(host.querySelector('input[name="grupo"]')?.getAttribute('value')).toBe(grupo2)
    expect(host.querySelector('input[name="contexto"]')?.getAttribute('value')).toBe('versao')
    expect(mocks.acao).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Trocar de empresa e descartar')
    await act(async()=>host.querySelector<HTMLButtonElement>('button[value="puxar"]')!.click())
    expect(document.body.textContent).toContain('Trocar de empresa e descartar as anotações?')
    expect(mocks.acao).not.toHaveBeenCalled()
  } finally {await act(async()=>root.unmount());host.remove()}
})
