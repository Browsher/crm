import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

let banco: BancoDeTeste, eu: string, empresa: string
beforeAll(async () => { banco=await criarBancoDeTeste(); eu=await criarUsuario(banco,'vendedor','Autoridade') })
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql("UPDATE usuario SET ativo=true,papel='vendedor',senha_provisoria_pendente=false WHERE id=$1",[eu])
  const [r]=await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone) VALUES('Autoridade','11987654321') RETURNING id")
  empresa=r.id
  await vincularGrupoAtivo(banco,[empresa])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[empresa,eu])
})

test.each(['papel','vinculo','arquivo','pendencia'])('venda da Carteira revalida %s depois de aguardar empresa',async mudanca=>{
  await sql(`SELECT ${comandos.contato} AS r`,[empresa,randomUUID(),await versao()])
  const [{id}]=await banco.sql<{id:string}>('SELECT id FROM negociacao WHERE empresa_id=$1',[empresa])
  expect(await sql("SELECT funil_venda_registrar($1,$2,'2026-01-01',1000,NULL) AS r",[id,randomUUID()])).toBe('ok')
  const c=new Client({connectionString:banco.urlAdmin});await c.connect()
  let pendente:Promise<unknown>|undefined
  try {
    await c.query('BEGIN');await c.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE',[empresa])
    pendente=sql("SELECT carteira_venda_registrar($1,$2,'2026-01-01',2000,NULL) AS r",[empresa,randomUUID()])
    await expect.poll(async()=>(await banco.sql<{r:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT carteira_venda_registrar%') AS r"))[0].r).toBe(true)
    if(mudanca==='papel')await c.query("UPDATE usuario SET papel='gestor' WHERE id=$1",[eu])
    if(mudanca==='vinculo') {
      const outro=await criarUsuario(banco,'vendedor','AutoridadeOutra'+randomUUID().slice(0,8))
      await c.query('UPDATE empresa_vinculo SET vendedor_id=$2 WHERE empresa_id=$1',[empresa,outro])
    }
    if(mudanca==='arquivo')await c.query('UPDATE empresa_vinculo SET arquivada_em=now() WHERE empresa_id=$1',[empresa])
    if(mudanca==='pendencia')await c.query("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'conflito','{}')",[empresa])
    await c.query('COMMIT')
    expect(await pendente).toBe(mudanca==='arquivo'?'arquivada':mudanca==='pendencia'?'desatualizada':'sem_permissao')
    expect(await banco.sql('SELECT valor_centavos FROM venda WHERE empresa_id=$1',[empresa])).toEqual([{valor_centavos:'1000'}])
  } finally {await c.query('ROLLBACK');await c.end();await pendente}
})
const sql=(texto:string,args:unknown[]=[])=>banco.comoUsuario(eu,async e=>(await e<{r:unknown}>(texto,args)).linhas[0]?.r)
const versao=async()=>(await banco.sql<{versao:number}>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1',[empresa]))[0].versao
const comandos={
  iniciar:'atendimento_iniciar($1,$2,$3)',
  contato:"contato_registrar_direto($1,$2,$3,'interessado',NULL,NULL,NULL)",
  arquivar:'empresa_sem_interesse_definir($1,$2,$3,NULL)',
  retomar:'empresa_atendimento_retomar($1,$2,$3)',
}
async function indisponibilizar(motivo:string) {
  if(motivo==='origem') await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)',[empresa])
  else await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'conflito','{}')",[empresa])
}
const retrato=()=>banco.sql(`SELECT to_jsonb(v) AS vinculo,
  (SELECT count(*) FROM contato WHERE empresa_id=$1) AS contatos,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'empresa_id',empresa_id,'vendedor_id',vendedor_id,
    'etapa',etapa,'iniciada_em',iniciada_em,'encerramento',encerramento,'encerrada_em',encerrada_em) ORDER BY id),'[]'::jsonb)
    FROM negociacao WHERE empresa_id=$1) AS negociacoes,
  (SELECT count(*) FROM venda WHERE empresa_id=$1) AS vendas FROM empresa_vinculo v WHERE empresa_id=$1`,[empresa])

for(const [nome,comando] of Object.entries(comandos)) for(const motivo of ['origem','pendencia']) {
  test(`${nome}: ${motivo} recusa intenção nova, preserva replay e libera intenção posterior`,async()=>{
    const chave=randomUUID(),v=await versao()
    const resultado=await sql(`SELECT ${comando} AS r`,[empresa,chave,v])
    expect(resultado).toMatchObject({ok:true,repetida:false})
    await indisponibilizar(motivo)
    const antes=await retrato(),nova=randomUUID(),atual=await versao()
    expect(await sql(`SELECT ${comando} AS r`,[empresa,chave,v])).toMatchObject({ok:true,repetida:true})
    expect(await sql(`SELECT ${comando} AS r`,[empresa,nova,atual])).toEqual({ok:false,motivo:'desatualizada'})
    expect(await retrato()).toEqual(antes)
    expect(await banco.sql('SELECT resultado FROM empresa_atendimento_operacao WHERE chave=$1',[nova])).toEqual([{resultado:{ok:false,motivo:'desatualizada'}}])
    await banco.sql('DELETE FROM empresa_vinculo_pendencia WHERE empresa_id=$1',[empresa])
    await banco.sql('UPDATE grupo_importacao SET ativo=true WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)',[empresa])
    expect(await sql(`SELECT ${comando} AS r`,[empresa,nova,atual])).toEqual({ok:false,motivo:'desatualizada'})
    if(nome==='arquivar') expect(await sql('SELECT empresa_atendimento_retomar($1,$2,$3) AS r',[empresa,randomUUID(),await versao()])).toMatchObject({ok:true})
    expect(await sql(`SELECT ${comando} AS r`,[empresa,randomUUID(),await versao()])).toMatchObject({ok:true})
  })
}

test.each(['origem','pendencia'])('etapa e primeira venda recusam %s sem efeito',async motivo=>{
  await sql(`SELECT ${comandos.contato} AS r`,[empresa,randomUUID(),await versao()])
  const [{id}]=await banco.sql<{id:string}>('SELECT id FROM negociacao WHERE empresa_id=$1',[empresa])
  await indisponibilizar(motivo)
  const antes=await retrato()
  expect(await sql("SELECT funil_etapa_definir($1,'em_negociacao','primeiro_contato') AS r",[id])).toBe('desatualizada')
  expect(await sql("SELECT funil_venda_registrar($1,$2,'2026-01-01',1000,NULL) AS r",[id,randomUUID()])).toBe('desatualizada')
  expect(await retrato()).toEqual(antes)
})

test.each(['origem','pendencia','arquivo'])('venda posterior recusa %s, replay permanece e retomar permite venda sem negociação',async motivo=>{
  await sql(`SELECT ${comandos.contato} AS r`,[empresa,randomUUID(),await versao()])
  const [{id}]=await banco.sql<{id:string}>('SELECT id FROM negociacao WHERE empresa_id=$1',[empresa])
  const primeira=randomUUID(),posterior=randomUUID()
  expect(await sql("SELECT funil_venda_registrar($1,$2,'2026-01-01',1000,NULL) AS r",[id,primeira])).toBe('ok')
  const vender=(chave:string)=>sql("SELECT carteira_venda_registrar($1,$2,'2026-01-01',1000,NULL) AS r",[empresa,chave])
  expect(await vender(posterior)).toBe('ok')
  if(motivo==='arquivo') await sql(`SELECT ${comandos.arquivar} AS r`,[empresa,randomUUID(),await versao()])
  else await indisponibilizar(motivo)
  const antes=await retrato()
  expect(await vender(posterior)).toBe('ok')
  expect(await sql("SELECT funil_venda_registrar($1,$2,'2026-01-01',1000,NULL) AS r",[id,primeira])).toBe('ok')
  expect(await vender(randomUUID())).toBe(motivo==='arquivo'?'arquivada':'desatualizada')
  expect(await retrato()).toEqual(antes)
  if(motivo==='arquivo') {
    expect(await sql(`SELECT ${comandos.retomar} AS r`,[empresa,randomUUID(),await versao()])).toMatchObject({ok:true})
    expect(await vender(randomUUID())).toBe('ok')
    expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL',[empresa])).toEqual([])
  }
})
