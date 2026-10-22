import { expect, test, vi } from 'vitest'
import { salvarPlanoAcao } from './acoes'
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'00000000-0000-4000-8000-000000000001'})}))
vi.mock('next/cache',()=>({revalidatePath:()=>{}}))
vi.mock('@/src/features/google/repositorio',()=>({repositorioGoogle:()=>({planejar:async()=>({ok:true,id:'00000000-0000-4000-8000-000000000002'})})}))
vi.mock('@/src/server/google/planilha/sincronizar',()=>({sincronizarPedido:async()=>({estado:'pendente',motivo:'Conexão indisponível'})}))
test('falha da planilha informa plano salvo com sincronização pendente',async()=>{
  const form=new FormData()
  for(const [k,v] of Object.entries({dia:'2026-10-26',nicho:'Brinquedos',bairro:'',cidade:'São Paulo',uf:'SP'})) form.set(k,v)
  expect(await salvarPlanoAcao({erro:null,salvo:false},form)).toMatchObject({erro:null,salvo:true,sincronizacao:'pendente'})
})
