import { beforeEach, expect, test, vi } from 'vitest'
const iniciar = vi.hoisted(() => vi.fn())
const destino=vi.hoisted(()=>vi.fn())
vi.mock('@/src/server/atendimento/pos-registro',()=>({lerDestinoEmpresaAtual:destino}))
const revalidar = vi.hoisted(() => vi.fn())
vi.mock('@/src/server/autenticacao/guarda', () => ({ exigir: async () => ({ usuarioId: 'eu' }) }))
vi.mock('@/src/server/atendimento/operacoes', () => ({ iniciarAtendimento: iniciar, retomarAtendimento: iniciar }))
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
import { iniciarAtendimentoAcao, retomarAtendimentoAcao } from './acoes'
beforeEach(() => { vi.resetAllMocks(); destino.mockResolvedValue({ok:true,destino:{tipo:'atendimento',empresaId:'empresa'}}); iniciar.mockResolvedValue({ ok: true, versao: 2, repetida: false }) })
test('inicia somente a empresa explícita com versão e chave recebidas', async () => {
  const form = new FormData()
  form.set('id', 'empresa'); form.set('chave', 'chave'); form.set('versao', '1'); form.set('vendedor', 'outro')
  expect(await iniciarAtendimentoAcao(form)).toMatchObject({ ok: true, versao: 2, repetida: false })
  expect(iniciar).toHaveBeenCalledWith('eu', { empresaId: 'empresa', chave: 'chave', versao: 1 })
  expect(revalidar).toHaveBeenCalledWith('/fila/localizar')
})
test('conflito é explícito e não informa sucesso', async () => {
  iniciar.mockResolvedValue({ ok: false, motivo: 'desatualizada' })
  expect(await iniciarAtendimentoAcao(new FormData())).toEqual({ ok: false, motivo: 'desatualizada' })
})

test.each([iniciarAtendimentoAcao,retomarAtendimentoAcao])('replay consulta situação atual somente após RPC confirmada',async(acao)=>{
 destino.mockResolvedValueOnce({ok:true,destino:{tipo:'carteira',empresaId:'empresa'}})
 const f=new FormData();f.set('id','empresa');f.set('usuarioId','outro')
 expect(await acao(f)).toMatchObject({ok:true,leituraDestino:{ok:true,destino:{tipo:'carteira',empresaId:'empresa'}}})
 expect(iniciar.mock.invocationCallOrder[0]).toBeLessThan(destino.mock.invocationCallOrder[0])
 expect(destino).toHaveBeenCalledWith('eu','empresa')
})
test('falhas posteriores conservam confirmação da retomada',async()=>{
 destino.mockRejectedValueOnce(new Error('leitura'))
 revalidar.mockImplementation(()=>{throw new Error('cache')})
 expect(await retomarAtendimentoAcao(new FormData())).toMatchObject({ok:true,leituraDestino:{ok:false}})
})
