// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect,test,vi } from 'vitest'
vi.mock('./cartao',()=>({Cartao:()=>null}))
vi.mock('@/src/features/contato/formulario',()=>({FormularioContato:({rascunho,onDraftChange,onSaved,empresaId}:{rascunho?:{nota:string};onDraftChange:(v:unknown)=>void;onSaved:(id:string)=>void;empresaId:string})=><div><p>{rascunho?.nota}</p><button onClick={()=>onDraftChange({tipo:'nao_liguei',nota:'Nota '+empresaId,proximoPasso:'',proximoPassoData:''})}>Anotar</button><button onClick={()=>onSaved(empresaId)}>Salvar</button></div>}))
import { Formulario } from './formulario'
import { RascunhosProvider } from './rascunhos'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
test('provider preserva duas empresas ao navegar e limpa somente a empresa salva',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  const base:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'A'},id:'A',nome:'Aurora',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['banco'],recebidaEm:null,situacao:'atendimento',versao:2,negociacaoId:null}
  async function mostrar(id:string){await act(async()=>root.render(<RascunhosProvider><Formulario empresa={{...base,id,referencia:{tipo:'cadastro',empresaId:id}}} fase="inicial" filtros={{}} contatos={[]}/></RascunhosProvider>))}
  async function clicar(nome:string){await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===nome)!.click())}
  try {await mostrar('A');await clicar('Anotar');await mostrar('B');await clicar('Anotar');await mostrar('A');expect(host.textContent).toContain('Nota A');await clicar('Salvar');await mostrar('B');expect(host.textContent).toContain('Nota B');await mostrar('A');expect(host.textContent).not.toContain('Nota A')}
  finally {await act(async()=>root.unmount());host.remove()}
})