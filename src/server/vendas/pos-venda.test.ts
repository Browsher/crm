import { beforeEach, expect, test, vi } from 'vitest'
const db=vi.hoisted(()=>({como:vi.fn(),executar:vi.fn()}))
vi.mock('../db/como-usuario',()=>({comoUsuario:db.como}))
import { lerDestinoVenda } from './pos-venda'
beforeEach(()=>{vi.clearAllMocks();db.como.mockImplementation((_ator,fn)=>fn(db.executar));db.executar.mockResolvedValue({linhas:[{empresa_id:'empresa-real'}]})})
test('destino lê venda autorizada por chave e autor após sucesso, inclusive negociação encerrada',async()=>{
 expect(await lerDestinoVenda('ator','chave',{tipo:'primeira',negociacaoId:'ciclo'})).toEqual({ok:true,destino:{tipo:'carteira',empresaId:'empresa-real'}})
 expect(db.como).toHaveBeenCalledWith('ator',expect.any(Function))
 const [sql,args]=db.executar.mock.calls[0]
 expect(sql).toContain('empresa_vinculo');expect(sql).toContain('autor_id');expect(sql).not.toContain('encerrada_em IS NULL')
 expect(args).toEqual(['chave','ator','ciclo'])
})
test('recompra usa vínculo e venda, sem confiar no empresaId local; falha de leitura permanece separada',async()=>{
 await lerDestinoVenda('ator','chave',{tipo:'recompra'})
 expect(db.executar.mock.calls[0][1]).toEqual(['chave','ator',null])
 db.executar.mockResolvedValueOnce({linhas:[]})
 expect(await lerDestinoVenda('ator','chave',{tipo:'recompra'})).toEqual({ok:false,motivo:'leitura_indisponivel'})
 db.executar.mockRejectedValueOnce(Error('db'))
 expect(await lerDestinoVenda('ator','chave',{tipo:'recompra'})).toEqual({ok:false,motivo:'leitura_indisponivel'})
})
