import { beforeEach, expect, test, vi } from 'vitest'
const mocks=vi.hoisted(()=>({exigir:vi.fn(),registrar:vi.fn(),revalidar:vi.fn()}))
vi.mock('@/src/server/autenticacao/guarda',()=>({exigir:mocks.exigir}))
vi.mock('@/src/features/vendas/repositorio',()=>({registrarVenda:mocks.registrar}))
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidar}))
import { vendaCarteiraAcao } from './venda-acao'
const id='00000000-0000-4000-8000-000000000001'
function form(){const f=new FormData();for(const[k,v]of Object.entries({id,chave:id,valor:'125,50',data:'2026-01-01',observacao:'  Nova compra  ',confirmado:'sim'}))f.set(k,v);return f}
beforeEach(()=>{vi.clearAllMocks();mocks.exigir.mockResolvedValue({usuarioId:'vendedor'});mocks.registrar.mockResolvedValue({ok:true})})
test('venda usa identidade da sessão, valor em centavos e atualiza histórico e agenda',async()=>{
  expect(await vendaCarteiraAcao(form())).toEqual({ok:true})
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
