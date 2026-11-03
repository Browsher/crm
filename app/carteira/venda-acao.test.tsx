import { beforeEach, expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({destino:vi.fn(),exigir:vi.fn(),registrar:vi.fn(),revalidar:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:mocks.exigir}))
vi.mock('@/src/features/vendas/repositorio',()=>({registrarVenda:mocks.registrar}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidar}))
vi.mock('@/src/server/vendas/pos-venda',()=>({lerDestinoVenda:mocks.destino}))
import { vendaCarteiraAcao } from './venda-acao'
const id='00000000-0000-4000-8000-000000000001'
function form(){const f=new FormData();for(const[k,v]of Object.entries({id,chave:id,valor:'125,50',data:'2026-01-01',observacao:'  Nova compra  ',confirmado:'sim'}))f.set(k,v);return f}
beforeEach(()=>{vi.clearAllMocks();mocks.exigir.mockResolvedValue({usuarioId:'vendedor'});mocks.registrar.mockResolvedValue({ok:true})})
test('venda usa identidade da sessão, valor em centavos e atualiza histórico e agenda',async()=>{
  expect(await vendaCarteiraAcao(form())).toMatchObject({ok:true})
  expect(mocks.exigir).toHaveBeenCalledWith('vendedor')
  expect(mocks.registrar).toHaveBeenCalledWith('vendedor',id,{chave:id,centavos:12550,data:'2026-01-01',observacao:'Nova compra'})
  for(const rota of ['/carteira',`/carteira/${id}`,'/meu-dia',`/empresas/${id}`])expect(mocks.revalidar).toHaveBeenCalledWith(rota)
})
test('não grava sem confirmação, valor válido ou permissão',async()=>{
  const f=form();f.delete('confirmado');expect((await vendaCarteiraAcao(f)).ok).toBe(false)
  f.set('confirmado','sim');f.set('valor','0');expect((await vendaCarteiraAcao(f)).ok).toBe(false)
  expect(mocks.registrar).not.toHaveBeenCalled()
  mocks.registrar.mockResolvedValue({ok:false,motivo:'sem_permissao'})
  expect(await vendaCarteiraAcao(form())).toMatchObject({ok:false,erro:expect.any(String)})
  expect(mocks.revalidar).not.toHaveBeenCalled()
})

test.each(['arquivada','desatualizada'])('estado %s retorna orientação definitiva sem falso sucesso',async motivo=>{
 mocks.registrar.mockResolvedValue({ok:false,motivo})
 const resultado=await vendaCarteiraAcao(form())
 expect(resultado.ok).toBe(false)
 if(resultado.ok)throw Error('Esperava recusa')
 expect(resultado.erro).toMatch(motivo==='arquivada'?/Retome/:/Atualize/)
 expect(mocks.revalidar).not.toHaveBeenCalled()
})

test.each(['sem_permissao','nao_cliente','dados_invalidos','chave_reutilizada','arquivada','desatualizada'])('recusa recompra %s só permite nova intenção quando lookup provou ausência',async motivo=>{
 mocks.registrar.mockResolvedValue({ok:false,motivo})
 expect(await vendaCarteiraAcao(form())).toMatchObject({ok:false,recusaConclusiva:['arquivada','desatualizada'].includes(motivo)})
})
test('falha posterior não converte recompra confirmada em resultado desconhecido',async()=>{
 mocks.destino.mockRejectedValueOnce(Error('leitura'));mocks.revalidar.mockImplementation(()=>{throw Error('cache')})
 expect(await vendaCarteiraAcao(form())).toMatchObject({ok:true,leituraDestino:{ok:false}})
})
test('recompra inválida devolve erro de campos estruturado; data futura da RPC também',async()=>{
 const f=form();f.set('valor','abc')
 expect(await vendaCarteiraAcao(f)).toMatchObject({ok:false,erroDeCampos:true})
 mocks.registrar.mockResolvedValueOnce({ok:false,motivo:'dados_invalidos'})
 expect(await vendaCarteiraAcao(form())).toMatchObject({ok:false,erroDeCampos:true,recusaConclusiva:false})
})