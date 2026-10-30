// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
const iniciar=vi.hoisted(()=>vi.fn())
vi.mock('../atendimento/acoes',()=>({iniciarAtendimentoAcao:iniciar,retomarAtendimentoAcao:iniciar}))
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:()=> <div role="dialog">Dados salvos</div>}))
import { EmpresasBancoRecentes } from './empresas-recentes'
import type { EmpresaBancoRecente } from '@/src/lib/empresas-banco-recentes'
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function montar(n=11) {
  const empresas:EmpresaBancoRecente[]=Array.from({length:n},(_,i)=>({id:'busca:'+i,buscaId:'busca',empresaId:null,nome:'Empresa '+i,cnpj:String(i).padStart(14,'0'),cnae:null,cep:null,porte:null,abertura:null,bairro:'Centro',cidade:'São Paulo',uf:'SP',origens:['banco'],nichos:[],regioes:[],entrada:'2026-10-29T12:00Z',situacao:'consultada',atividade:null,endereco:'Centro',comTelefone:false,comEmail:false}))
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  await act(async()=>root.render(<EmpresasBancoRecentes empresas={empresas}/>))
}
test('três por página, onze únicos, controles limitados e Ver busca permanece disponível',async()=>{
  await montar(14)
  expect(host.querySelectorAll('li')).toHaveLength(3)
  expect([...host.querySelectorAll('a')].filter(a=>a.textContent==='Ver busca')).toHaveLength(3)
  const proxima=[...host.querySelectorAll('button')].find(b=>b.textContent==='Próximas empresas')!
  for(let i=0;i<3;i++)await act(async()=>proxima.click())
  expect(host.querySelectorAll('li')).toHaveLength(2);expect(proxima.disabled).toBe(true)
  expect(host.textContent).toContain('Página 4 de 4')
  expect(host.querySelector('a[href="/fila/localizar?origem=banco"]')).not.toBeNull()
})
test('Ver empresa abre diálogo comum sem aquisição; snapshot não recebe ação comercial',async()=>{
  await montar(1)
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Ver empresa')!.click())
  expect(host.querySelector('[role=dialog]')).not.toBeNull()
  expect(host.textContent).not.toContain('Iniciar atendimento')
  expect(iniciar).not.toHaveBeenCalled()
})
test('vazio explica ausência sem card fictício',async()=>{await montar(0);expect(host.querySelectorAll('li')).toHaveLength(0);expect(host.textContent).toContain('aparecerão aqui')})