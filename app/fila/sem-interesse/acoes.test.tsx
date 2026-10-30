import { beforeEach, expect, test, vi } from 'vitest'
const m=vi.hoisted(()=>({exigir:vi.fn(),retomar:vi.fn(),arquivar:vi.fn(),revalidar:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:m.exigir}))
vi.mock('@/src/server/atendimento/operacoes',()=>({retomarAtendimento:m.retomar,arquivarSemInteresse:m.arquivar}))
vi.mock('next/cache',()=>({revalidatePath:m.revalidar}))
import { retomarAcao, arquivarAcao } from './acoes'
beforeEach(()=>{vi.clearAllMocks();m.exigir.mockResolvedValue({usuarioId:'eu'})})
test('retomada e arquivo pessoal usam comando comum e ator autenticado',async()=>{
 const f=new FormData();f.set('id','empresa');f.set('versao','3');f.set('chave','original');f.set('usuarioId','forjado')
 m.retomar.mockResolvedValue({ok:true,versao:4,repetida:true});m.arquivar.mockResolvedValue({ok:true,versao:4,repetida:false})
 expect(await retomarAcao(f)).toMatchObject({ok:true,repetida:true})
 await arquivarAcao(f)
 expect(m.retomar).toHaveBeenCalledWith('eu',{empresaId:'empresa',versao:3,chave:'original'})
 expect(m.arquivar).toHaveBeenCalledWith('eu',{empresaId:'empresa',versao:3,chave:'original'},null)
 expect(m.revalidar).toHaveBeenCalledWith('/fila/sem-interesse')
})
