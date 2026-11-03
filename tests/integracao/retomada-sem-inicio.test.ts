import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento } from './atendimento-fixtures'
import { arquivarSemInteresse, retomarAtendimento } from '@/src/server/atendimento/operacoes'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { lerDestinoEmpresaAtual } from '@/src/server/atendimento/pos-registro'
let banco:BancoDeTeste
beforeEach(async()=>{banco=await criarBancoDeTeste()})
afterEach(async()=>{await banco?.derrubar()})
test('retomada e replay de empresa nunca iniciada abrem atendimento autorizado sem iniciar ou criar contato',async()=>{
 const c=await cenarioAtendimento(banco)
 const arquivo=await arquivarSemInteresse(c.vendedorId,{empresaId:c.empresaId,chave:randomUUID(),versao:c.versao},null)
 if(!arquivo.ok)throw new Error('Fixture não arquivada')
 const comando={empresaId:c.empresaId,chave:randomUUID(),versao:arquivo.versao}
 const original=await retomarAtendimento(c.vendedorId,comando)
 expect(original).toMatchObject({ok:true,repetida:false})
 expect(await lerAtendimento(c.vendedorId,c.empresaId)).toMatchObject({ok:true,empresa:{situacao:'a_contatar'}})
 expect(await lerDestinoEmpresaAtual(c.vendedorId,c.empresaId)).toEqual({ok:true,destino:{tipo:'atendimento',empresaId:c.empresaId}})
 expect(await retomarAtendimento(c.vendedorId,comando)).toEqual({...original,repetida:true})
 expect(await lerDestinoEmpresaAtual(c.vendedorId,c.empresaId)).toEqual({ok:true,destino:{tipo:'atendimento',empresaId:c.empresaId}})
 expect(await lerDestinoEmpresaAtual(c.outroId,c.empresaId)).toEqual({ok:false,motivo:'leitura_indisponivel'})
 expect(await banco.sql('SELECT iniciada_em,agenda_contato_id,arquivada_em FROM empresa_vinculo WHERE empresa_id=$1',[c.empresaId])).toEqual([{iniciada_em:null,agenda_contato_id:null,arquivada_em:null}])
 expect(await banco.sql('SELECT id FROM contato WHERE empresa_id=$1',[c.empresaId])).toHaveLength(0)
 expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1',[c.empresaId])).toHaveLength(0)
 expect(await banco.sql('SELECT chave FROM empresa_atendimento_operacao WHERE chave=$1',[comando.chave])).toHaveLength(1)
})
