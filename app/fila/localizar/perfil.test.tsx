import { expect, test, vi } from 'vitest'
const ler=vi.hoisted(()=>vi.fn())
const redirect=vi.hoisted(()=>vi.fn((url:string)=>{throw new Error(url)}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/server/atendimento/consulta',()=>({lerAtendimento:ler}))
vi.mock('next/navigation',()=>({redirect}))
import Pagina from './[id]/page'
test('bookmark inequívoco autorizado mantém empresa e filtros sem aquisição',async()=>{
  ler.mockResolvedValue({ok:true})
  await expect(Pagina({params:Promise.resolve({id:'empresa'}),searchParams:Promise.resolve({grupo:'velho',origem:'banco',pagina:'2'})})).rejects.toThrow('/fila/atendimento/empresa?origem=banco&pagina=2')
})
test('bookmark alheio retorna entrada pessoal sem revelar nem adquirir empresa',async()=>{
  ler.mockResolvedValue({ok:false,motivo:'sem_permissao'})
  await expect(Pagina({params:Promise.resolve({id:'alheio'}),searchParams:Promise.resolve({grupo:'velho'})})).rejects.toThrow('/fila/localizar?pagina=1')
})