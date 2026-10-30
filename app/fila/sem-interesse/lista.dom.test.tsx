// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { ListaSemInteresse } from './lista'
import { retomarAcao } from './acoes'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('./acoes',()=>({retomarAcao:vi.fn()}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:()=> <p>Consulta sem negociação</p>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();sessionStorage.clear()})
test('arquivo paginado consulta empresa nunca negociada e retoma sem forjar negociação',async()=>{
 const e:ResumoEmpresa={referencia:{tipo:'cadastro',empresaId:'e'},id:'e',nome:'Nunca negociada',cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['legado'],recebidaEm:null,situacao:'sem_interesse',versao:2,negociacaoId:null}
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<ListaSemInteresse usuarioId="teste" empresas={[e]} total={21} filtros={{nome:'Nunca'}}/>))
 expect(host.querySelector('a[href*="pagina=2"]')?.getAttribute('href')).toContain('nome=Nunca')
 expect(host.querySelector('input[name=cnpj]')).not.toBeNull()
 const clicar=async(nome:string)=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===nome)!.click())
 await clicar('Ver empresa');expect(host.textContent).toContain('Consulta sem negociação')
 vi.mocked(retomarAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:true,versao:3,repetida:true})
 await clicar('Retomar atendimento');expect(host.textContent).toContain('Não foi possível confirmar')
 await clicar('Retomar atendimento')
 expect(vi.mocked(retomarAcao).mock.calls[1][0].get('chave')).toBe(vi.mocked(retomarAcao).mock.calls[0][0].get('chave'))
 expect(host.textContent).not.toContain('Abrir no funil')
})

test('retomada desconhecida pode confirmar após refresh sem empresa no arquivo',async()=>{
 sessionStorage.setItem('crm:retomar-arquivo:v1:teste',JSON.stringify({id:'antiga',versao:4,chave:'original'}))
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<ListaSemInteresse usuarioId="teste" empresas={[]} total={0} filtros={{}}/>))
 vi.mocked(retomarAcao).mockResolvedValue({ok:true,versao:5,repetida:true})
 await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Confirmar retomada anterior')!.click())
 const f=vi.mocked(retomarAcao).mock.calls.at(-1)![0]
 expect(f.get('id')).toBe('antiga');expect(f.get('chave')).toBe('original')
 expect(host.textContent).toContain('Envio anterior confirmado')
})
