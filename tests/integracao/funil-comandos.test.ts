import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
let banco: BancoDeTeste, eu: string, outro: string, gestor: string, empresa: string, ciclo: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco,'vendedor','Vendas')
  outro = await criarUsuario(banco,'vendedor','Outro')
  gestor = await criarUsuario(banco,'gestor','Gestor')
  empresa = (await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES('33444555000166','Venda teste','11999999999') RETURNING id"))[0].id
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM venda; DELETE FROM negociacao; DELETE FROM contato; DELETE FROM empresa_fila')
  await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false')
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[empresa,eu])
  ciclo = (await banco.sql<{id:string}>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id',[empresa,eu]))[0].id
})
const agir = (ator:string,sql:string,args:unknown[]) => banco.comoUsuario(ator,e=>e<{resultado:string}>(sql,args)).then(r=>r.linhas[0].resultado)
const vender = (ator=eu,chave=randomUUID(),valor=1234,data='2026-01-01') => agir(ator,'SELECT funil_venda_registrar($1,$2,$3,$4,NULL) AS resultado',[ciclo,chave,data,valor])
test('etapa confere dono, valor anterior e não modifica data de início', async () => {
  const antes=await banco.sql('SELECT iniciada_em FROM negociacao')
  expect(await agir(outro,"SELECT funil_etapa_definir($1,'proposta_enviada','primeiro_contato') AS resultado",[ciclo])).toBe('sem_permissao')
  expect(await agir(eu,"SELECT funil_etapa_definir($1,'em_negociacao','primeiro_contato') AS resultado",[ciclo])).toBe('ok')
  expect(await agir(eu,"SELECT funil_etapa_definir($1,'proposta_enviada','primeiro_contato') AS resultado",[ciclo])).toBe('desatualizada')
  expect(await banco.sql('SELECT iniciada_em FROM negociacao')).toEqual(antes)
})
test('venda é atômica, idempotente e preserva retorno na agenda', async () => {
  await banco.comoUsuario(eu,e=>e("SELECT contato_registrar($1,'acompanhamento','nota','Ligar',CURRENT_DATE,'nenhum')",[empresa]))
  const antes=await lerMinhasEmpresas(eu,true)
  expect(antes.ok && antes.carteira).toEqual([])
  const chave=randomUUID()
  expect(await Promise.all([vender(eu,chave),vender(eu,chave)])).toEqual(['ok','ok'])
  expect(await vender()).toBe('encerrada')
  expect(await vender(eu,chave,500)).toBe('chave_reutilizada')
  expect(await banco.sql('SELECT valor_centavos FROM venda')).toEqual([{valor_centavos:'1234'}])
  expect(await banco.sql('SELECT encerramento FROM negociacao')).toEqual([{encerramento:'venda'}])
  const carteira=await lerMinhasEmpresas(eu,true), agenda=await lerMinhasEmpresas(eu)
  expect(carteira.ok && carteira.carteira.map(e=>e.id)).toEqual([empresa])
  expect(agenda.ok && agenda.carteira[0].proximoPasso).toBe('Ligar')
})
test('venda nega terceiros, gestor, senha pendente, valor e data futura', async () => {
  for (const ator of [outro,gestor]) expect(await vender(ator)).toBe('sem_permissao')
  expect(await vender(eu,randomUUID(),0)).toBe('dados_invalidos')
  expect(await vender(eu,randomUUID(),1234,'9999-01-01')).toBe('dados_invalidos')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[eu])
  expect(await vender()).toBe('sem_permissao')
  expect(await banco.sql('SELECT id FROM venda')).toEqual([])
})
test('devolver exige motivo e grava autoria; venda concorrente não fica sem dono', async () => {
  expect(await agir(eu,"SELECT funil_devolver($1,' ') AS resultado",[ciclo])).toBe('dados_invalidos')
  const resultados=await Promise.all([vender(),agir(eu,"SELECT funil_devolver($1,'Sem interesse') AS resultado",[ciclo])])
  expect(resultados.filter(x=>x==='ok')).toHaveLength(1)
  const vendas=await banco.sql('SELECT id FROM venda')
  if (vendas.length) expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{vendedor_id:eu}])
  else expect(await banco.sql('SELECT nota,criado_por FROM contato')).toEqual([{nota:'Sem interesse',criado_por:eu}])
})

test.each(['etapa','venda'])('reconfere autorização após esperar trava de empresa: %s',async(comando)=>{
  const trava=new Client({connectionString:banco.urlAdmin});await trava.connect()
  try{
    await trava.query('BEGIN');await trava.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE',[empresa])
    const resultado=comando==='venda'?vender():agir(eu,"SELECT funil_etapa_definir($1,'em_negociacao','primeiro_contato') AS resultado",[ciclo])
    await expect.poll(async()=>{
      const [r]=await banco.sql<{aguardando:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT funil_%') AS aguardando")
      return r.aguardando
    }).toBe(true)
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[eu])
    await trava.query('COMMIT')
    expect(await resultado).toBe('sem_permissao')
    expect(await banco.sql('SELECT etapa,encerramento FROM negociacao')).toEqual([{etapa:'primeiro_contato',encerramento:null}])
    expect(await banco.sql('SELECT id FROM venda')).toEqual([])
  }finally{await trava.query('ROLLBACK');await trava.end()}
})
