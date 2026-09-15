import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { registrarContato } from '@/src/features/contato/repositorio'
import { lerFunil, lerNegociacao } from '@/src/features/funil/consulta'
import { lerDashboard } from '@/src/features/gestao/consulta'

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
  // Permite observar o RED antes da nova migração, sem falhar no preparo.
  await banco.sql("DO $$ BEGIN IF to_regclass('venda') IS NOT NULL THEN DELETE FROM venda; DELETE FROM negociacao; END IF; END $$")
  await banco.sql('DELETE FROM contato; DELETE FROM empresa_fila; DELETE FROM fila_contexto')
  await banco.sql('UPDATE usuario SET ativo=true, senha_provisoria_pendente=false')
})
async function reservar(ator: string) {
  return banco.comoUsuario(ator, e => e<{ resultado: string }>(
    "SELECT * FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,(SELECT versao FROM fila_contexto WHERE usuario_id=usuario_atual()))", [empresa]))
}
async function assumir(ator: string) {
  expect((await reservar(ator)).linhas[0].resultado).toBe('ok')
  return registrarContato(ator, empresa, { tipo:'interessado',nota:'Nota de '+ator,proximoPasso:null,proximoPassoData:null,desfecho:'assumir' })
}
async function devolver(ator: string) {
  return registrarContato(ator, empresa, { tipo:'sem_interesse',nota:'Devolvida',proximoPasso:null,proximoPassoData:null,desfecho:'devolver' })
}
async function venda() {
  await banco.sql("INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,12500,gen_random_uuid())", [empresa,a])
}

test('reserva não cria ciclo; assumir, repetir e devolver preservam um ciclo e o contato', async () => {
  const [schema] = await banco.sql<{ existe: boolean }>("SELECT to_regclass('negociacao') IS NOT NULL AS existe")
  expect(schema.existe).toBe(true)
  await reservar(a)
  expect(await banco.sql('SELECT * FROM negociacao')).toHaveLength(0)
  expect(await assumir(a)).toEqual({ ok:true })
  expect(await registrarContato(a,empresa,{tipo:'interessado',nota:null,proximoPasso:null,proximoPassoData:null,desfecho:'assumir'})).toEqual({ok:false,motivo:'ja_e_sua'})
  expect(await banco.sql('SELECT etapa,encerramento FROM negociacao')).toEqual([{etapa:'primeiro_contato',encerramento:null}])
  expect(await devolver(a)).toEqual({ok:true})
  expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'devolucao'}])
  expect(await banco.sql('SELECT id FROM contato')).toHaveLength(2)
  await banco.sql('UPDATE empresa_fila SET elegivel_em=NULL')
  expect(await assumir(b)).toEqual({ok:true})
  expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(2)
})

test('erro no contato desfaz assunção e ciclo na mesma transação', async () => {
  await reservar(a)
  await expect(registrarContato(a,empresa,{tipo:'interessado',nota:null,proximoPasso:'incompleto',proximoPassoData:null,desfecho:'assumir'})).rejects.toMatchObject({code:'23514'})
  expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:null}])
  expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(0)
})

test('cliente não é devolvido; venda encerra ciclo e permanece com dono inativo fora da fila', async () => {
  await assumir(a)
  await venda()
  expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'venda'}])
  expect(await devolver(a)).toEqual({ok:false,motivo:'sem_permissao'})
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[a])
  expect((await reservar(b)).linhas[0].resultado).toBe('indisponivel')
  const r = await banco.comoUsuario(b, e=>e<{disponibilidade:string}>("SELECT disponibilidade FROM empresa_consultar('',NULL,NULL,NULL,NULL,1)"))
  expect(r.linhas).toEqual([{disponibilidade:'outro_vendedor'}])
  expect((await banco.comoUsuario(b,e=>e('SELECT * FROM empresa_sugestoes()'))).linhas).toEqual([])
  expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:a}])
  expect((await lerDashboard(gestor))?.disponiveis).toBe(0)
})

test('funil filtra autoria também no último contato e não devolve dados de outro dono', async () => {
  await assumir(a)
  const [antiga] = await lerFunil(a)
  await devolver(a)
  await banco.sql('UPDATE empresa_fila SET elegivel_em=NULL')
  await assumir(b)
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

test('prospecto de dono inativo pode ser reassumido sem dois ciclos abertos', async () => {
  await assumir(a)
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[a])
  expect(await assumir(b)).toEqual({ok:true})
  expect(await banco.sql('SELECT vendedor_id FROM negociacao WHERE encerrada_em IS NULL')).toEqual([{vendedor_id:b}])
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

test('duas assunções concorrentes não criam dois ciclos', async () => {
  await reservar(a)
  const resultados = await Promise.all([1,2].map(()=>registrarContato(a,empresa,{tipo:'interessado',nota:null,proximoPasso:null,proximoPassoData:null,desfecho:'assumir'})))
  expect(resultados.filter(r=>r.ok)).toHaveLength(1)
  expect(resultados.filter(r=>!r.ok)).toEqual([{ok:false,motivo:'ja_e_sua'}])
  expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(1)
  expect(await banco.sql('SELECT id FROM contato')).toHaveLength(1)
})

test('venda concorrente com devolução nunca deixa cliente disponível', async () => {
  await assumir(a)
  const resultados = await Promise.allSettled([venda(),devolver(a)])
  const vendas = await banco.sql('SELECT id FROM venda')
  if (vendas.length) {
    expect(resultados[0].status).toBe('fulfilled')
    expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:a}])
    expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'venda'}])
  } else {
    expect(resultados[0].status).toBe('rejected')
    expect(resultados[1]).toMatchObject({status:'fulfilled',value:{ok:true}})
    expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:null}])
    expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'devolucao'}])
  }
})
