import { expect, test, vi } from 'vitest'
const reservar=vi.hoisted(()=>vi.fn())
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/features/fila/repositorio',()=>({reservarEmpresa:reservar}))
import { agirNaFilaAcao } from './acoes'
test.each(['puxar','renovar'])('formulário antigo %s não adquire empresa nem renova reserva',async(acao)=>{
  const f=new FormData();f.set('acao',acao);f.set('grupo','antigo')
  expect(await agirNaFilaAcao({erro:null,filaVazia:false},f)).toMatchObject({filaVazia:false,erro:expect.stringContaining('encerrado')})
  expect(reservar).not.toHaveBeenCalled()
})