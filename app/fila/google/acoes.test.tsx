import { expect, test, vi } from 'vitest'
import { salvarPlanoAcao, salvarSemanaAcao, copiarPlanoAcao } from './acoes'
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'00000000-0000-4000-8000-000000000001'})}))
vi.mock('next/cache',()=>({revalidatePath:()=>{}}))
vi.mock('@/src/features/google/repositorio',()=>({repositorioGoogle:()=>({planejar:async()=>({ok:true,id:'00000000-0000-4000-8000-000000000002'}),salvarSemana:async()=>({ok:true,ids:['00000000-0000-4000-8000-000000000002']}),copiarDia:async()=>({ok:true,ids:['00000000-0000-4000-8000-000000000002']})})}))
vi.mock('@/src/server/google/planilha/sincronizar',()=>({sincronizarPedido:async()=>({estado:'pendente',motivo:'Conexão indisponível'})}))
test('falha da planilha informa plano salvo com sincronização pendente',async()=>{
  const form=new FormData()
  for(const [k,v] of Object.entries({dia:'2026-10-26',nicho:'Brinquedos',bairro:'',cidade:'São Paulo',uf:'SP'})) form.set(k,v)
  expect(await salvarPlanoAcao({erro:null,salvo:false},form)).toMatchObject({erro:null,salvo:true,sincronizacao:'pendente'})
})
test('semana aceita dia vazio e mantém aviso de sincronização pendente', async () => {
  const form = new FormData()
  form.set('dias', JSON.stringify([{ dia: '2026-10-26', nicho: '', bairro: '', cidade: '', uf: '' }]))
  expect(await salvarSemanaAcao({ erro: null, salvo: false }, form)).toMatchObject({ salvo: true, sincronizacao: 'pendente' })
})
test('cópia exige campos e destinos antes de enviar ao repositório', async () => {
  expect(await copiarPlanoAcao({ erro: null, salvo: false }, new FormData())).toMatchObject({ salvo: false })
})
