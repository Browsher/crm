import { beforeEach, expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({exigir:vi.fn(),ler:vi.fn(),vender:vi.fn(),etapa:vi.fn(),devolver:vi.fn(),arquivar:vi.fn(),atendimento:vi.fn(),revalidar:vi.fn()}))
vi.mock('@/src/server/atendimento/operacoes',()=>({arquivarSemInteresse:mocks.arquivar}))
vi.mock('@/src/server/atendimento/consulta',()=>({lerAtendimento:mocks.atendimento}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:mocks.exigir}))
vi.mock('@/src/features/funil/consulta',()=>({lerNegociacao:mocks.ler}))
vi.mock('@/src/features/funil/repositorio',()=>({registrarVenda:mocks.vender,mudarEtapa:mocks.etapa,devolverNegociacao:mocks.devolver}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidar}))
import { detalheAcao, vendaAcao, etapaAcao, semInteresseAcao } from './acoes'
beforeEach(()=>{vi.clearAllMocks();mocks.exigir.mockResolvedValue({usuarioId:'eu'});mocks.vender.mockResolvedValue({ok:true})})

test('arquivo exige identidade completa e usa replay antes de conferir estado atual',async()=>{
 const f=new FormData()
 expect((await semInteresseAcao(f)).ok).toBe(false);expect(mocks.arquivar).not.toHaveBeenCalled()
 for(const[k,v]of Object.entries({id:'00000000-0000-4000-8000-000000000001',empresaId:'00000000-0000-4000-8000-000000000002',chave:'00000000-0000-4000-8000-000000000003',versao:'3'}))f.set(k,v)
 mocks.arquivar.mockResolvedValue({ok:true,versao:4,repetida:true});mocks.atendimento.mockResolvedValue({ok:true,empresa:{situacao:'cliente',versao:5}})
 expect(await semInteresseAcao(f)).toMatchObject({ok:true,repetida:true,atual:false})
 expect(mocks.arquivar).toHaveBeenCalledWith('eu',{empresaId:f.get('empresaId'),chave:f.get('chave'),versao:3},f.get('id'))
 expect(mocks.arquivar.mock.invocationCallOrder[0]).toBeLessThan(mocks.atendimento.mock.invocationCallOrder[0])
 for(const p of ['/funil','/fila/sem-interesse','/meu-dia'])expect(mocks.revalidar).toHaveBeenCalledWith(p)
})

test('action recusa salto e retrocesso antes do repositório',async()=>{
  mocks.etapa.mockResolvedValue({ok:true})
  for(const [anterior,etapa] of [['primeiro_contato','proposta_enviada'],['em_negociacao','primeiro_contato'],['proposta_enviada','proposta_enviada']]){
    const f=new FormData();f.set('anterior',anterior);f.set('etapa',etapa)
    expect((await etapaAcao(f)).ok).toBe(false)
  }
  expect(mocks.etapa).not.toHaveBeenCalled()
})
test('todas ações exigem vendedor antes de acessar dados',async()=>{
  mocks.exigir.mockRejectedValue(new Error('negado'))
  for(const chamada of [()=>detalheAcao('id'),()=>vendaAcao(new FormData()),()=>etapaAcao(new FormData()),()=>semInteresseAcao(new FormData())]) await expect(chamada()).rejects.toThrow('negado')
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

test('primeira venda explica indisponibilidade sem afirmar mudança de etapa ou perda de autorização',async()=>{
  mocks.vender.mockResolvedValue({ok:false,motivo:'desatualizada'})
  const f=new FormData()
  for(const[k,v]of Object.entries({id:'ciclo',valor:'12,34',data:'2026-09-15',chave:'12345678-1234-1234-1234-123456789012',confirmado:'sim'}))f.set(k,v)
  const r=await vendaAcao(f)
  expect(r).toMatchObject({ok:false,indisponivel:false})
  expect(r.erro).toContain('indisponível')
  expect(mocks.revalidar).not.toHaveBeenCalled()
})
