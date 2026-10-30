import { expect, test, vi } from 'vitest'
import { lerTelefoneNegociacao, lerFunil, contarSemInteresse } from './consulta'
const resumos=vi.hoisted(()=>({ler:vi.fn()}))
vi.mock('@/src/server/atendimento/consulta',()=>({lerResumosEmpresas:resumos.ler}))
let linhas: unknown[] = []
vi.mock('@/src/server/db/como-usuario', () => ({ comoUsuario: async (_id: string, trabalho: (e: unknown) => unknown) => trabalho(async () => ({ linhas })) }))
test('empresa acessível sem telefone permite atendimento, empresa inacessível retorna null', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  linhas = [{ telefone: null }]
  expect(await lerTelefoneNegociacao(id, id)).toBe('')
  linhas = []
  expect(await lerTelefoneNegociacao(id, id)).toBeNull()
})

test('Funil enriquece em lotes de até100 e total não lê arquivo completo',async()=>{
 linhas=Array.from({length:101},(_,i)=>({id:String(i),empresaId:String(i),nome:'Empresa',cidade:null,etapa:'primeiro_contato'}))
 resumos.ler.mockImplementation(async(_id:string,ids:string[])=>({ok:true,empresas:ids.map(id=>({id,versao:7,situacao:'primeiro_contato',negociacaoId:id}))}))
 const r=await lerFunil('eu')
 expect(r).toHaveLength(101);expect(r[100].versao).toBe(7)
 expect(resumos.ler.mock.calls.map(c=>c[1].length)).toEqual([100,1])
 linhas=[{permitido:true,total:24}];expect(await contarSemInteresse('eu')).toEqual({ok:true,total:24})
 linhas=[{permitido:false,total:0}];expect(await contarSemInteresse('eu')).toEqual({ok:false,motivo:'sem_permissao'})
})
