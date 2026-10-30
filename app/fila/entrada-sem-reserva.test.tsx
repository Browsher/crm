import { beforeEach, expect, test, vi } from 'vitest'
const minhas=vi.hoisted(()=>vi.fn())
const ler=vi.hoisted(()=>vi.fn())
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:async()=>({usuarioId:'eu'})}))
vi.mock('@/src/features/fila/consulta',()=>({lerMinhasEmpresas:minhas}))
vi.mock('@/src/server/atendimento/consulta',()=>({lerAtendimento:ler}))
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error(url)}}))
import Pagina from './page'
beforeEach(()=>vi.clearAllMocks())
test('grupo antigo sem empresa nunca consulta próxima nem reserva global',async()=>{
  await expect(Pagina({searchParams:Promise.resolve({grupo:'antigo',nome:'Aurora'})})).rejects.toThrow('/fila/localizar?nome=Aurora&pagina=1')
  expect(minhas).not.toHaveBeenCalled();expect(ler).not.toHaveBeenCalled()
})
test('atendimento antigo só recupera identidade inequívoca e autorizada',async()=>{
  minhas.mockResolvedValue({ok:true,reserva:{id:'A'}});ler.mockResolvedValue({ok:true})
  await expect(Pagina({searchParams:Promise.resolve({atendimento:'1'})})).rejects.toThrow('/fila/atendimento/A')
})