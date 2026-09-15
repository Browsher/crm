import { beforeEach, expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({exigir:vi.fn(),ler:vi.fn(),vender:vi.fn(),etapa:vi.fn(),devolver:vi.fn(),revalidar:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:mocks.exigir}))
vi.mock('@/src/features/funil/consulta',()=>({lerNegociacao:mocks.ler}))
vi.mock('@/src/features/funil/repositorio',()=>({registrarVenda:mocks.vender,mudarEtapa:mocks.etapa,devolverNegociacao:mocks.devolver}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidar}))
import { detalheAcao, vendaAcao, etapaAcao, devolverAcao } from './acoes'
beforeEach(()=>{vi.clearAllMocks();mocks.exigir.mockResolvedValue({usuarioId:'eu'});mocks.vender.mockResolvedValue({ok:true})})
test('todas ações exigem vendedor antes de acessar dados',async()=>{
  mocks.exigir.mockRejectedValue(new Error('negado'))
  for(const chamada of [()=>detalheAcao('id'),()=>vendaAcao(new FormData()),()=>etapaAcao(new FormData()),()=>devolverAcao(new FormData())]) await expect(chamada()).rejects.toThrow('negado')
  expect(mocks.ler).not.toHaveBeenCalled();expect(mocks.vender).not.toHaveBeenCalled();expect(mocks.etapa).not.toHaveBeenCalled();expect(mocks.devolver).not.toHaveBeenCalled()
  expect(mocks.exigir).toHaveBeenCalledWith('vendedor')
})
test('venda exige confirmação, usa ator da sessão e revalida consumidores',async()=>{
  const f=new FormData();for(const [k,v]of Object.entries({id:'ciclo',valor:'12,34',data:'2026-09-15',chave:'12345678-1234-1234-1234-123456789012',usuarioId:'forjado'}))f.set(k,v)
  expect((await vendaAcao(f)).ok).toBe(false);expect(mocks.vender).not.toHaveBeenCalled()
  f.set('confirmado','sim');expect(await vendaAcao(f)).toMatchObject({ok:true})
  expect(mocks.vender).toHaveBeenCalledWith('eu','ciclo',expect.objectContaining({centavos:1234}))
  for(const p of ['/funil','/carteira','/meu-dia','/gestao'])expect(mocks.revalidar).toHaveBeenCalledWith(p)
})
