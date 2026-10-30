import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { contatoDireto } from './fixtures/contato-direto'
import { lerFunil, lerNegociacao } from '@/src/features/funil/consulta'
import { lerDashboard } from '@/src/features/gestao/consulta'
import { randomUUID } from 'node:crypto'
import { registrarContatoDireto } from '@/src/server/atendimento/operacoes'

let banco: BancoDeTeste
let a: string, b: string, gestor: string, empresa: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  a = await criarUsuario(banco, 'vendedor', 'Ana')
  b = await criarUsuario(banco, 'vendedor', 'Bia')
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES('11222333000181','Aurora','11987654321') RETURNING id")
  empresa = e.id
  await banco.sql("WITH g AS (INSERT INTO grupo_importacao(nome) VALUES('Origem') RETURNING id) INSERT INTO grupo_importacao_empresa SELECT id,$1 FROM g", [empresa])
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM empresa_atendimento_operacao; DELETE FROM empresa_vinculo')
  await banco.sql('DELETE FROM venda; DELETE FROM negociacao')
  await banco.sql('DELETE FROM contato; DELETE FROM empresa_fila; DELETE FROM fila_contexto')
  await banco.sql('DELETE FROM empresa_atendimento_operacao; DELETE FROM empresa_vinculo')
  await banco.sql('UPDATE usuario SET ativo=true, senha_provisoria_pendente=false')
})
async function vincular(ator:string) {
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado') ON CONFLICT(empresa_id) DO NOTHING",[empresa,ator])
}
async function assumir(ator:string) {
  await vincular(ator)
  return contatoDireto(banco,ator,empresa,{tipo:'interessado',nota:'Nota de '+ator,proximoPasso:null,proximoPassoData:null})
}
async function devolver(ator:string) {
  return contatoDireto(banco,ator,empresa,{tipo:'sem_interesse',nota:'Arquivada',proximoPasso:null,proximoPassoData:null})
}
async function venda() {
  await banco.sql("INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,12500,gen_random_uuid())", [empresa,a])
}

test('vínculo não cria ciclo; interesse repetido preserva ciclo e arquivo preserva dono',async()=>{
 await vincular(a)
 expect(await banco.sql('SELECT id FROM negociacao')).toEqual([])
 expect(await assumir(a)).toMatchObject({ok:true})
 expect(await assumir(a)).toMatchObject({ok:true})
 expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(1)
 expect(await devolver(a)).toMatchObject({ok:true})
 expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'sem_interesse'}])
 expect(await assumir(b)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT id FROM contato')).toHaveLength(3)
})
test('entrada inválida não assume nem cria ciclo',async()=>{
 await vincular(a)
 expect(await contatoDireto(banco,a,empresa,{tipo:'interessado',nota:null,proximoPasso:'incompleto',proximoPassoData:null})).toEqual({ok:false,motivo:'dados_invalidos'})
 expect(await banco.sql('SELECT id FROM negociacao')).toEqual([])
 expect(await banco.sql('SELECT empresa_id FROM empresa_fila')).toEqual([])
})
test('cliente arquivado preserva dono inativo e não volta ao catálogo',async()=>{
 await assumir(a);await venda()
 expect(await devolver(a)).toMatchObject({ok:true})
 await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[a])
 expect(await assumir(b)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:a}])
 expect((await lerDashboard(gestor))?.disponiveis).toBe(0)
})

test('funil filtra autoria também no último contato e não devolve dados de outro dono', async () => {
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[empresa,a])
  expect(await registrarContatoDireto(a,{empresaId:empresa,chave:randomUUID(),versao:1},{tipo:'interessado',nota:'Nota de '+a,proximoPasso:null,proximoPassoData:null})).toMatchObject({ok:true})
  const [antiga] = await lerFunil(a)
  expect(await registrarContatoDireto(a,{empresaId:empresa,chave:randomUUID(),versao:antiga.versao},{tipo:'sem_interesse',nota:'Sem interesse em conversa real',proximoPasso:null,proximoPassoData:null})).toMatchObject({ok:true})
  // Mudança administrativa explícita somente da fixture para observar o novo
  // dono. Não há comando de transferência no aplicativo.
  await banco.sql('UPDATE empresa_vinculo SET vendedor_id=$2,arquivada_em=NULL,versao=versao+1 WHERE empresa_id=$1',[empresa,b])
  await banco.sql('UPDATE empresa_fila SET vendedor_id=$2 WHERE empresa_id=$1',[empresa,b])
  const [{versao}]=await banco.sql<{versao:number}>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1',[empresa])
  expect(await registrarContatoDireto(b,{empresaId:empresa,chave:randomUUID(),versao},{tipo:'interessado',nota:'Nota de '+b,proximoPasso:null,proximoPassoData:null})).toMatchObject({ok:true})
  const [atual] = await lerFunil(b)
  expect(atual).toMatchObject({empresaId:empresa,nome:'Aurora',cidade:null,etapa:'primeiro_contato'})
  expect(atual).not.toHaveProperty('telefone')
  expect(await lerFunil(a)).toEqual([])
  expect(await lerFunil(gestor)).toEqual([])
  expect(await lerNegociacao(a,atual.id)).toBeNull()
  expect(await lerNegociacao(b,antiga.id)).toBeNull()
  expect(await lerNegociacao(b,'invalido')).toBeNull()
  // Nota alheia mais recente não pode contaminar o resumo da negociação.
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
  try {
    await banco.sql("INSERT INTO contato(empresa_id,tipo,nota,criado_por,criado_em,proximo_passo,proximo_passo_data) VALUES($1,'acompanhamento','segredo alheio',$2,now()+interval '1 minute','passo alheio',CURRENT_DATE)",[empresa,a])
  } finally { await banco.sql('ALTER TABLE contato ENABLE TRIGGER contato_auditoria') }
  const detalhe = await lerNegociacao(b,atual.id)
  expect(detalhe?.historico).toHaveLength(1)
  expect(detalhe?.historico[0].nota).toBe('Nota de '+b)
  expect(detalhe?.proximoPasso).toBeNull()
  expect(JSON.stringify(detalhe)).not.toContain('alheio')
  expect((await banco.comoUsuario(gestor,e=>e('SELECT * FROM contato'))).linhas).toHaveLength(4)
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[b])
  expect(await lerFunil(b)).toEqual([])
  expect(await lerNegociacao(b,atual.id)).toBeNull()
})

test('venda exige dono ativo, valor positivo, data finita e chave única; não perde ciclo no rollback', async () => {
  await assumir(a)
  const sql = 'INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,$3,$4,$5)'
  const chave = 'bcaa7974-9e58-4c18-a65e-87689ea075be'
  for (const [autor,data,valor] of [[b,'2026-09-15',100],[a,'infinity',100],[a,'2026-09-15',0]]) {
    await expect(banco.sql(sql,[empresa,autor,data,valor,chave])).rejects.toMatchObject({code:'23514'})
    expect(await banco.sql('SELECT id FROM negociacao WHERE encerrada_em IS NULL')).toHaveLength(1)
  }
  await banco.sql(sql,[empresa,a,'2026-09-15',100,chave])
  await expect(banco.sql(sql,[empresa,a,'2026-09-15',100,chave])).rejects.toMatchObject({code:'23505'})
  expect(await banco.sql('SELECT id FROM venda')).toHaveLength(1)
  expect(await banco.sql('SELECT id FROM negociacao WHERE encerrada_em IS NULL')).toHaveLength(0)
  expect(await lerFunil(a)).toEqual([])
})

test('prospecto de dono inativo não é redistribuído',async()=>{
 await assumir(a);await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[a])
 expect(await assumir(b)).toEqual({ok:false,motivo:'sem_permissao'})
 expect(await banco.sql('SELECT vendedor_id FROM negociacao WHERE encerrada_em IS NULL')).toEqual([{vendedor_id:a}])
})

test('negociação e venda não aceitam escrita direta nem executáveis internos pelo app', async () => {
  await assumir(a)
  for (const ator of [a,gestor]) {
    for (const sql of ['DELETE FROM negociacao','UPDATE negociacao SET etapa=\'proposta_enviada\'','DELETE FROM venda',"INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,100,gen_random_uuid())"]) {
      await expect(banco.comoUsuario(ator,e=>e(sql,sql.includes('$1')?[empresa,a]:undefined))).rejects.toMatchObject({code:'42501'})
    }
  }
  expect((await banco.comoUsuario(b,e=>e('SELECT * FROM negociacao'))).linhas).toEqual([])
  expect((await banco.comoUsuario(a,e=>e('SELECT * FROM negociacao'))).linhas).toHaveLength(1)
  expect((await banco.comoUsuario(gestor,e=>e('SELECT * FROM negociacao'))).linhas).toHaveLength(1)
  await expect(banco.comoUsuario(a,e=>e('SELECT empresa_cliente($1)',[empresa]))).rejects.toMatchObject({code:'42501'})
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[a])
  expect(await devolver(a)).toEqual({ok:false,motivo:'sem_permissao'})
})

test('duas intenções com mesma versão não duplicam contato ou ciclo',async()=>{
 await vincular(a)
 const resultados=await Promise.all([1,2].map(()=>registrarContatoDireto(a,{empresaId:empresa,chave:randomUUID(),versao:1},{tipo:'interessado',nota:null,proximoPasso:null,proximoPassoData:null})))
 expect(resultados.filter(r=>r.ok)).toHaveLength(1)
 expect(resultados.filter(r=>!r.ok)).toEqual([{ok:false,motivo:'desatualizada'}])
 expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(1)
 expect(await banco.sql('SELECT id FROM contato')).toHaveLength(1)
})
