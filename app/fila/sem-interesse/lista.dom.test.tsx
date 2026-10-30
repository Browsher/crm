// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ListaSemInteresse } from './lista'
import { retomarAcao } from './acoes'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('./acoes',()=>({retomarAcao:vi.fn()}))
vi.mock('@/src/components/crm/empresa-dialogo',()=>({EmpresaDialogo:()=> <p>Consulta sem negociação</p>}))
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
let root:ReturnType<typeof createRoot>,host:HTMLDivElement
beforeEach(()=>vi.resetAllMocks())
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
 await clicar('Confirmar retomada anterior')
 expect(vi.mocked(retomarAcao).mock.calls[1][0].get('chave')).toBe(vi.mocked(retomarAcao).mock.calls[0][0].get('chave'))
 expect(host.textContent).not.toContain('Abrir no funil')
})

const empresa=(id:string):ResumoEmpresa=>({referencia:{tipo:'cadastro',empresaId:id},id,nome:'Empresa '+id,cnpj:null,cnae:null,atividade:null,bairro:null,cidade:null,uf:null,origens:['banco'],recebidaEm:null,situacao:'sem_interesse',versao:4,negociacaoId:null})
async function montar(empresas=[empresa('A'),empresa('B')],usuarioId='teste') {host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<ListaSemInteresse usuarioId={usuarioId} empresas={empresas} total={empresas.length} filtros={{}}/>))}
async function clicar(nome:string){await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===nome)!.click())}

test('tentativa desconhecida de A não é enviada ao clicar na retomada de B; consulta permanece livre',async()=>{
 vi.mocked(retomarAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:true,versao:5,repetida:true})
 await montar();const b=[...host.querySelectorAll('li')][1]
 const retomarB=[...b.querySelectorAll('button')].find(x=>x.textContent==='Retomar atendimento')!
 await clicar('Retomar atendimento')
 await act(async()=>retomarB.click())
 expect(retomarAcao).toHaveBeenCalledTimes(1)
 await act(async()=>b.querySelector<HTMLButtonElement>('button[aria-label="Ver empresa: Empresa B"]')!.click())
 expect(host.textContent).toContain('Consulta sem negociação')
 await clicar('Confirmar retomada anterior')
 expect(Object.fromEntries(vi.mocked(retomarAcao).mock.calls[1][0])).toEqual(Object.fromEntries(vi.mocked(retomarAcao).mock.calls[0][0]))
})

test.each(['sem_permissao','nao_encontrada'] as const)('retomada conserva comando completo após %s, remontagem e replay',async motivo=>{
 vi.mocked(retomarAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo}).mockResolvedValueOnce({ok:true,versao:5,repetida:true})
 await montar();await clicar('Retomar atendimento');await clicar('Confirmar retomada anterior')
 expect(sessionStorage.getItem('crm:retomar-arquivo:v1:teste')).not.toBeNull()
 const original=Object.fromEntries(vi.mocked(retomarAcao).mock.calls[0][0])
 await act(async()=>root.unmount());host.remove();await montar([],'outro')
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 await act(async()=>root.unmount());host.remove();await montar([])
 await clicar('Confirmar retomada anterior')
 expect(Object.fromEntries(vi.mocked(retomarAcao).mock.calls[2][0])).toEqual(original)
 expect(sessionStorage.getItem('crm:retomar-arquivo:v1:teste')).toBeNull()
})

test('retomada conclusivamente recusada libera nova intenção',async()=>{
 vi.mocked(retomarAcao).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ok:false,motivo:'desatualizada'})
 await montar();await clicar('Retomar atendimento');await clicar('Confirmar retomada anterior')
 expect(sessionStorage.getItem('crm:retomar-arquivo:v1:teste')).toBeNull()
 expect(host.textContent).not.toContain('Confirmar retomada anterior')
 expect(host.textContent).toContain('Retomar atendimento')
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
