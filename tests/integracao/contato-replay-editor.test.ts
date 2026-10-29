import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento } from './atendimento-fixtures'
import { registrarContatoDireto, arquivarSemInteresse, retomarAtendimento } from '@/src/server/atendimento/operacoes'
let banco: BancoDeTeste
beforeAll(async()=>{banco=await criarBancoDeTeste()})
afterAll(async()=>{await banco?.derrubar()})
test('replay do editor depois de arquivo e retomada mantém efeito único; acompanhamento novo é recusado',async()=>{
  const c=await cenarioAtendimento(banco)
  const interesse=await registrarContatoDireto(c.vendedorId,{empresaId:c.empresaId,chave:randomUUID(),versao:c.versao},{tipo:'interessado',nota:null,proximoPasso:null,proximoPassoData:null})
  if(!interesse.ok)throw new Error('Interesse recusado')
  const comando={empresaId:c.empresaId,chave:randomUUID(),versao:interesse.versao}
  const entrada={tipo:'acompanhamento' as const,nota:'Nota preservada',proximoPasso:'Ligar',proximoPassoData:'2030-01-01'}
  const original=await registrarContatoDireto(c.vendedorId,comando,entrada)
  if(!original.ok)throw new Error('Acompanhamento recusado')
  const arquivo=await arquivarSemInteresse(c.vendedorId,{empresaId:c.empresaId,chave:randomUUID(),versao:original.versao},null)
  if(!arquivo.ok)throw new Error('Arquivo recusado')
  expect(await registrarContatoDireto(c.vendedorId,comando,entrada)).toEqual({...original,repetida:true})
  const retomada=await retomarAtendimento(c.vendedorId,{empresaId:c.empresaId,chave:randomUUID(),versao:arquivo.versao})
  if(!retomada.ok)throw new Error('Retomada recusada')
  expect(await registrarContatoDireto(c.vendedorId,comando,entrada)).toEqual({...original,repetida:true})
  expect(await registrarContatoDireto(c.vendedorId,{...comando,chave:randomUUID(),versao:retomada.versao},entrada)).toEqual({ok:false,motivo:'dados_invalidos'})
  expect(await banco.sql("SELECT nota FROM contato WHERE empresa_id=$1 AND tipo='acompanhamento'",[c.empresaId])).toEqual([{nota:'Nota preservada'}])
  expect(await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1',[c.empresaId])).toEqual([{agenda_contato_id:null}])
  expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL',[c.empresaId])).toHaveLength(0)
})
