import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { beforeAll, beforeEach, afterAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import { DESFECHO_SUGERIDO } from '@/src/features/contato/tipos'
import { agendaDoDia } from '@/app/meu-dia/agenda'
let banco:BancoDeTeste, eu:string, outro:string, gestor:string, empresa:string
beforeAll(async()=>{
  banco=await criarBancoDeTeste();eu=await criarUsuario(banco,'vendedor','Compras');outro=await criarUsuario(banco,'vendedor','Outro');gestor=await criarUsuario(banco,'gestor','Gestor')
  empresa=(await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES('22444555000177','Compras teste','11999998888') RETURNING id"))[0].id
})
afterAll(async()=>{await banco?.derrubar()})
beforeEach(async()=>{
  await banco.sql('DELETE FROM venda; DELETE FROM negociacao; DELETE FROM contato; DELETE FROM empresa_fila')
  await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false')
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[empresa,eu])
  await banco.sql('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)',[empresa,eu])
})
const agir=(ator:string,sql:string,args:unknown[])=>banco.comoUsuario(ator,e=>e<{r:string}>(sql,args)).then(r=>r.linhas[0].r)
const comprar=(ator=eu,chave=randomUUID(),valor=4500,data='2026-01-02')=>agir(ator,'SELECT carteira_venda_registrar($1,$2,$3,$4,NULL) AS r',[empresa,chave,data,valor])
async function primeira(){const [n]=await banco.sql<{id:string}>('SELECT id FROM negociacao');expect(await agir(eu,"SELECT funil_venda_registrar($1,$2,'2026-01-01',1200,NULL) AS r",[n.id,randomUUID()])).toBe('ok')}

test('retorno combinado assume a reserva e alimenta Funil e Meu dia',async()=>{
  await banco.sql('DELETE FROM negociacao; DELETE FROM empresa_fila')
  await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()+interval '30 minutes')",[empresa,eu])
  expect(await agir(eu,"SELECT contato_registrar($1,'retornar_depois',NULL,'Ligar',(now() AT TIME ZONE 'America/Sao_Paulo')::date,$2) AS r",[empresa,DESFECHO_SUGERIDO.retornar_depois])).toBe('ok')
  const agenda=await lerMinhasEmpresas(eu)
  expect(agenda.ok&&agenda.carteira).toEqual([expect.objectContaining({id:empresa,situacaoRetorno:'hoje',posse:true})])
  const clientes=await lerMinhasEmpresas(eu,true)
  expect(clientes.ok&&clientes.carteira).toEqual([])
  expect(await banco.sql('SELECT vendedor_id FROM negociacao WHERE encerrada_em IS NULL')).toEqual([{vendedor_id:eu}])
})

test('primeira e nova compra entram no histórico sem apagar retorno de hoje',async()=>{
  await banco.comoUsuario(eu,e=>e("SELECT contato_registrar($1,'acompanhamento','Ligar novamente','Ligar',(now() AT TIME ZONE 'America/Sao_Paulo')::date,'nenhum')",[empresa]))
  await primeira();const chave=randomUUID()
  expect(await Promise.all([comprar(eu,chave),comprar(eu,chave)])).toEqual(['ok','ok'])
  expect(await comprar(eu,chave,4600)).toBe('chave_reutilizada')
  const r=await lerHistorico(eu,empresa)
  expect(r.ok&&r.contatos.filter(c=>c.venda).map(c=>c.venda?.centavos).sort()).toEqual(['1200','4500'])
  const agenda=await lerMinhasEmpresas(eu)
  expect(agenda.ok&&agenda.carteira[0]).toMatchObject({situacaoRetorno:'hoje',proximoPasso:'Ligar'})
  expect((await banco.sql('SELECT id FROM contato')).length).toBe(1)
  expect((await banco.sql('SELECT id FROM venda')).length).toBe(2)
})
test('compra exige cliente e responsável regular; outros não registram nem leem',async()=>{
  expect(await comprar()).toBe('nao_cliente')
  await primeira()
  for(const ator of [outro,gestor])expect(await comprar(ator)).toBe('sem_permissao')
  expect(await comprar(eu,randomUUID(),0)).toBe('dados_invalidos')
  expect(await comprar(eu,randomUUID(),4500,'9999-01-01')).toBe('dados_invalidos')
  const historico=await lerHistorico(outro,empresa);expect(historico.ok&&historico.contatos).toEqual([])
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[eu]);expect(await comprar()).toBe('sem_permissao')
})

test('banco recusa retorno sem combinado ou com devolução sem gravar contato',async()=>{
  for(const args of [[null,null,'assumir'],['Ligar','2026-01-01','devolver'],['   ','2026-01-01','assumir']]){
    await expect(agir(eu,"SELECT contato_registrar($1,'retornar_depois',NULL,$2,$3,$4) AS r",[empresa,...args])).rejects.toMatchObject({code:'23514'})
  }
  expect(await banco.sql('SELECT id FROM contato')).toEqual([])
})

test('gestor lê vendas; vendedor desativado e novo responsável não registram indevidamente',async()=>{
  await primeira();expect(await comprar()).toBe('ok')
  const h=await lerHistorico(gestor,empresa);expect(h.ok&&h.contatos.filter(c=>c.venda)).toHaveLength(2)
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[eu]);expect(await comprar()).toBe('sem_permissao')
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[eu])
  await banco.sql('UPDATE empresa_fila SET vendedor_id=$1 WHERE empresa_id=$2',[outro,empresa])
  expect(await comprar()).toBe('sem_permissao')
  const privado=await lerHistorico(eu,empresa);expect(privado.ok&&privado.contatos.filter(c=>c.venda)).toEqual([])
})

test('retorno futuro fica no Funil, mas fora da agenda de hoje',async()=>{
  await banco.sql('DELETE FROM negociacao; DELETE FROM empresa_fila')
  await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()+interval '30 minutes')",[empresa,eu])
  expect(await agir(eu,"SELECT contato_registrar($1,'retornar_depois',NULL,'Ligar',(now() AT TIME ZONE 'America/Sao_Paulo')::date+1,'assumir') AS r",[empresa])).toBe('ok')
  const agenda=await lerMinhasEmpresas(eu)
  expect(agenda.ok&&agenda.carteira[0].situacaoRetorno).toBe('futuro')
  expect(agenda.ok&&agendaDoDia(agenda.carteira)).toEqual([])
  expect(await banco.sql('SELECT vendedor_id FROM negociacao WHERE encerrada_em IS NULL')).toEqual([{vendedor_id:eu}])
})

test('compra reconfere autorização revogada durante espera pelo lock',async()=>{
  await primeira()
  const trava=new Client({connectionString:banco.urlAdmin});await trava.connect()
  let resultado:Promise<string>|undefined
  try{
    await trava.query('BEGIN');await trava.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE',[empresa])
    resultado=comprar()
    await expect.poll(async()=>{
      const [r]=await banco.sql<{aguardando:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT carteira_venda_registrar%') AS aguardando")
      return r.aguardando
    }).toBe(true)
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[eu])
    await trava.query('COMMIT')
    expect(await resultado).toBe('sem_permissao')
    expect(await banco.sql('SELECT valor_centavos FROM venda')).toEqual([{valor_centavos:'1200'}])
  }finally{await trava.query('ROLLBACK');await trava.end();await resultado}
})
