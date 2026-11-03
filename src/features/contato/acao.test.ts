import { beforeEach, expect, test, vi } from 'vitest'
const gravar = vi.hoisted(() => vi.fn())
const ler = vi.hoisted(() => vi.fn())
const destino = vi.hoisted(() => vi.fn())
vi.mock('../../server/atendimento/pos-registro', () => ({ lerDestinoContato: destino }))
const revalidar = vi.hoisted(() => vi.fn())
const exigir = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath: revalidar }))
vi.mock('../../server/autenticacao/guarda', () => ({ exigir }))
vi.mock('../../server/atendimento/consulta', () => ({ lerAtendimento: ler }))
vi.mock('./repositorio', () => ({ registrarContato: gravar }))
import { registrarContatoAcao } from './acao'
beforeEach(() => { vi.resetAllMocks(); destino.mockResolvedValue({ok:true,destino:{tipo:'permanecer'}}); exigir.mockResolvedValue({usuarioId:'eu'}); ler.mockResolvedValue({ ok: true, fase: 'inicial', empresa: { versao: 8 } }); gravar.mockResolvedValue({ ok: true, versao: 4, repetida: false }) })
function form() { const f = new FormData(); for (const [k,v] of Object.entries({ id: 'empresa', tipo: 'nao_atendeu', nota: ' Nota ', chave: 'chave-estavel', versao: '3', posse: 'sim', fase: 'cliente', desfecho: 'devolver' })) f.set(k,v); return f }
test('usa ator e fase reais, preserva versão lida pelo editor e não envia posse/desfecho', async () => {
  expect(await registrarContatoAcao({ ok: false, erro: null }, form())).toMatchObject({ ok: true, erro: null, repetida: false })
  expect(gravar).toHaveBeenCalledWith('eu', { empresaId: 'empresa', chave: 'chave-estavel', versao: 3 }, { tipo: 'nao_atendeu', nota: 'Nota', proximoPasso: null, proximoPassoData: null })
  expect(revalidar).toHaveBeenCalledWith('/fila/localizar')
})
test('fase do navegador não autoriza acompanhamento inicial', async () => {
  const f = form(); f.set('tipo','acompanhamento'); f.set('proximoPasso','Ligar'); f.set('proximoPassoData','2027-03-01')
  gravar.mockResolvedValueOnce({ok:false,motivo:'dados_invalidos'})
  expect((await registrarContatoAcao({ ok:false, erro:null },f)).ok).toBe(false)
  expect(gravar).toHaveBeenCalled()
})
test('replay de acompanhamento alcança a RPC mesmo após arquivo encerrar a negociação', async () => {
  ler.mockResolvedValueOnce({ok:true,fase:'inicial',empresa:{situacao:'sem_interesse',versao:20}})
  gravar.mockResolvedValueOnce({ok:true,versao:4,repetida:true})
  const f=form();f.set('tipo','acompanhamento');f.set('proximoPasso','Ligar');f.set('proximoPassoData','2027-03-01')
  expect(await registrarContatoAcao({ok:false,erro:null},f)).toMatchObject({ok:true,repetida:true})
  expect(gravar.mock.calls[0][1].versao).toBe(3)
})
test('ID alheio não registra nada', async () => {
  gravar.mockResolvedValue({ ok:false, motivo:'sem_permissao' })
  expect((await registrarContatoAcao({ok:false,erro:null},form())).ok).toBe(false)
  expect(revalidar).not.toHaveBeenCalled()
})
test('leitura de disponibilidade não veta replay e não é chamada na escrita',async()=>{
  ler.mockResolvedValue({ok:false,motivo:'sem_permissao'})
  gravar.mockResolvedValueOnce({ok:true,versao:4,repetida:true})
  expect(await registrarContatoAcao({ok:false,erro:null},form())).toMatchObject({ok:true,repetida:true})
  expect(ler).not.toHaveBeenCalled()
  expect(gravar).toHaveBeenCalledWith('eu',{empresaId:'empresa',chave:'chave-estavel',versao:3},{tipo:'nao_atendeu',nota:'Nota',proximoPasso:null,proximoPassoData:null})
})
test('autenticação ainda precede o comando',async()=>{
  exigir.mockRejectedValueOnce(new Error('Sem sessão'))
  await expect(registrarContatoAcao({ok:false,erro:null},form())).rejects.toThrow('Sem sessão')
  expect(gravar).not.toHaveBeenCalled()
})
test('conflito mantém erro explícito, replay atualiza leituras', async () => {
  gravar.mockResolvedValueOnce({ok:false,motivo:'desatualizada'})
  expect(await registrarContatoAcao({ok:false,erro:null},form())).toMatchObject({ok:false,motivo:'desatualizada'})
  gravar.mockResolvedValueOnce({ok:true,versao:4,repetida:true})
  expect(await registrarContatoAcao({ok:false,erro:null},form())).toMatchObject({ok:true,repetida:true})
  expect(revalidar).toHaveBeenCalledWith('/fila/atendimento/empresa')
})

test('destino autenticado é consultado depois da RPC com resultado validado, sem fase do navegador',async()=>{
  const f=form();f.set('tipo','interessado')
  destino.mockResolvedValueOnce({ok:true,destino:{tipo:'funil',negociacaoId:'atual'}})
  expect(await registrarContatoAcao({ok:false,erro:null},f)).toMatchObject({ok:true,leituraDestino:{ok:true,destino:{tipo:'funil',negociacaoId:'atual'}}})
  expect(gravar.mock.invocationCallOrder[0]).toBeLessThan(destino.mock.invocationCallOrder[0])
  expect(destino).toHaveBeenCalledWith('eu','empresa','interessado')
})
test('leitura e revalidação posteriores falhando conservam sucesso confirmado',async()=>{
  destino.mockRejectedValueOnce(new Error('leitura'))
  revalidar.mockImplementation(()=>{throw new Error('cache')})
  expect(await registrarContatoAcao({ok:false,erro:null},form())).toMatchObject({ok:true,leituraDestino:{ok:false}})
})
test('recusa da RPC não consulta destino',async()=>{
  gravar.mockResolvedValueOnce({ok:false,motivo:'sem_permissao'})
  await registrarContatoAcao({ok:false,erro:null},form())
  expect(destino).not.toHaveBeenCalled()
})
