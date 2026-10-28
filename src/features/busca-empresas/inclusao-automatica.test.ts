import { expect, test, vi } from 'vitest'
import { garantirInclusao } from './inclusao-automatica'
test('inclui somente depois da consulta persistida e usa o ID, sem receber dados do navegador',async()=>{
 const repo={ler:vi.fn().mockResolvedValue({estado:'concluida'}),incluirAutomaticamente:vi.fn().mockResolvedValue({ok:true,grupoId:'lista',inseridas:5,vinculadas:5})}
 expect(await garantirInclusao(repo as never,'busca')).toMatchObject({ok:true,grupoId:'lista'})
 expect(repo.ler).toHaveBeenCalledWith('busca');expect(repo.incluirAutomaticamente).toHaveBeenCalledWith('busca')
 expect(repo.ler.mock.invocationCallOrder[0]).toBeLessThan(repo.incluirAutomaticamente.mock.invocationCallOrder[0])
})
test.each(['reservada','falhou'])('resultado %s não tenta incluir nem refazer a aquisição',async(estado)=>{
 const repo={ler:vi.fn().mockResolvedValue({estado}),incluirAutomaticamente:vi.fn()}
 expect(await garantirInclusao(repo as never,'busca')).toMatchObject({ok:true,aguardando:true})
 expect(repo.incluirAutomaticamente).not.toHaveBeenCalled()
})
test('resultado ausente ou bloqueado não ganha nova aquisição',async()=>{
 const repo={ler:vi.fn().mockResolvedValue(null),incluirAutomaticamente:vi.fn()}
 expect(await garantirInclusao(repo as never,'busca')).toMatchObject({ok:false})
 expect(repo.incluirAutomaticamente).not.toHaveBeenCalled()
})
