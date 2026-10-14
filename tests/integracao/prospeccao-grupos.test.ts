import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { Client } from 'pg'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string
let gestor: string
let grupo1: string
let grupo2: string
let empresaA: string
let empresaB: string
let empresaC: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco,'vendedor','ListaVendedor')
  gestor = await criarUsuario(banco,'gestor','ListaGestor')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM venda')
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM fila_contexto')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa')
  const grupos = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome,descricao,origem,criterios) VALUES ('Lista 1','Resumo 1','Fonte 1','Critério 1'),('Lista 2','Resumo 2','Fonte 2',NULL) RETURNING id")
  grupo1 = grupos[0].id
  grupo2 = grupos[1].id
  const empresas = await banco.sql<{id:string}>("INSERT INTO empresa(razao_social,telefone,cnae_principal) VALUES ('Aurora A','11987654321','1234567'),('Aurora B','11987654321','7654321'),('Cometa C','11987654321','9999999') RETURNING id")
  empresaA = empresas[0].id
  empresaB = empresas[1].id
  empresaC = empresas[2].id
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES ($1,$3),($1,$4),($2,$4),($2,$5)',[grupo1,grupo2,empresaA,empresaB,empresaC])
})
async function reservar(alvo:string|null,grupo:string|null,contexto:string|null=null) {
  const sql = "SELECT * FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,$2,$3)"
  const r = await banco.comoUsuario(vendedor,e=>e<{resultado:string;empresa_id:string|null;contexto:string|null}>(sql,[alvo,contexto,grupo]))
  return r.linhas[0]
}
test('empresa fora da lista não cria nem substitui a reserva',async () => {
  const a = await reservar(empresaA,grupo1)
  const antes = await banco.sql('SELECT * FROM empresa_fila')
  expect(await reservar(empresaC,grupo1,a.contexto)).toMatchObject({resultado:'indisponivel'})
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual(antes)
})
async function esperarReservaBloqueada() {
  const inicio=Date.now()
  while(Date.now()-inicio<5000) {
    const [{esperando}] = await banco.sql<{esperando:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%fila_reservar%') AS esperando")
    if(esperando) return
  }
  throw new Error('A sessão de reserva não entrou na espera pelo lock')
}
test('desativação concorrente bloqueia nova reserva e conserva a anterior',async () => {
  const a=await reservar(empresaA,grupo1)
  await banco.sql("INSERT INTO contato(empresa_id,tipo,nota) VALUES ($1,'nao_atendeu','Histórico anterior preservado')",[empresaA])
  const historico=await banco.sql('SELECT * FROM contato')
  const antes=await banco.sql('SELECT * FROM empresa_fila')
  const admin=new Client({connectionString:banco.urlAdmin})
  await admin.connect()
  let aberta=false
  let reservando:ReturnType<typeof reservar>|undefined
  try {
    await admin.query('BEGIN')
    aberta=true
    await admin.query("SELECT set_config('app.usuario_id',$1,true)",[gestor])
    await admin.query('SELECT pg_advisory_xact_lock(27,1)')
    await admin.query('SELECT grupo_importacao_situacao_definir($1,false)',[grupo2])
    reservando=reservar(empresaC,grupo2,a.contexto)
    await esperarReservaBloqueada()
    await admin.query('COMMIT')
    aberta=false
    expect(await reservando).toMatchObject({resultado:'grupo_indisponivel',empresa_id:empresaA,contexto:a.contexto})
    expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual(antes)
    expect(await banco.sql('SELECT * FROM contato')).toEqual(historico)
  } finally {
    if(aberta) await admin.query('ROLLBACK')
    await reservando?.catch(()=>undefined)
    await admin.end()
  }
})

async function consultar(grupo:string|null,nome='',cnae:string|null=null,uf:string|null=null,cidade:string|null=null,bairro:string|null=null,usuario=vendedor) {
  return (await banco.comoUsuario(usuario,e=>e<{id:string}>("SELECT * FROM empresa_consultar($1,$2,$3,$4,$5,1,$6)",[nome,cnae,uf,cidade,bairro,grupo]))).linhas
}
test('consulta combina lista com nome, CNAE e geografia sem duplicar empresa compartilhada',async()=>{
  await banco.sql("INSERT INTO cep(cep,uf,localidade,ibge,bairro,logradouro) VALUES ('01001000','SP','São Paulo','3550308','Centro','Praça') ON CONFLICT DO NOTHING")
  await banco.sql("UPDATE empresa SET cep='01001000' WHERE id=$1",[empresaA])
  expect((await consultar(grupo1)).map(e=>e.id)).toEqual([empresaA,empresaB])
  expect((await consultar(null)).map(e=>e.id)).toEqual([empresaA,empresaB,empresaC])
  expect(await consultar(grupo1,'Aurora','1234567','SP','3550308','Centro')).toMatchObject([{id:empresaA}])
  expect(await consultar(grupo2,'Aurora','1234567','SP','3550308','Centro')).toEqual([])
  expect(await consultar(grupo1,'Cometa')).toEqual([])
  const opcoes=await banco.comoUsuario(vendedor,e=>e<{tipo:string;valor:string}>('SELECT * FROM empresa_filtros(NULL,NULL,$1)',[grupo1]))
  expect(opcoes.linhas.filter(o=>o.tipo==='cnae').map(o=>o.valor)).toEqual(['1234567','7654321'])
  const cidade=await banco.comoUsuario(vendedor,e=>e<{tipo:string;valor:string}>("SELECT * FROM empresa_filtros('SP','3550308',$1)",[grupo1]))
  expect(cidade.linhas).toEqual(expect.arrayContaining([{tipo:'bairro',valor:'Centro',rotulo:'Centro'}]))
})
test('próxima candidata pertence à lista selecionada e nenhuma candidata mantém a anterior',async()=>{
  const c=await reservar(empresaC,grupo2)
  const a=await reservar(null,grupo1,c.contexto)
  expect([empresaA,empresaB]).toContain(a.empresa_id)
  const b=await reservar(null,grupo1,a.contexto)
  expect([empresaA,empresaB]).toContain(b.empresa_id)
  expect(b.empresa_id).not.toBe(a.empresa_id)
  await banco.sql("UPDATE empresa_fila SET elegivel_em=now()+interval '1 day' WHERE empresa_id=$1",[a.empresa_id])
  const antes=await banco.sql('SELECT * FROM empresa_fila')
  expect(await reservar(null,grupo1,b.contexto)).toMatchObject({resultado:'sem_candidata'})
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual(antes)
})
test('lista inexistente e inativa falham explicitamente em leituras e reservas dos dois papéis',async()=>{
  const inexistente='00000000-0000-4000-8000-000000000999'
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1',[grupo2])
  for(const grupo of [inexistente,grupo2]) {
    for(const usuario of [vendedor,gestor]) {
      await expect(consultar(grupo,'',null,null,null,null,usuario)).rejects.toMatchObject({code:'P0002'})
      await expect(banco.comoUsuario(usuario,e=>e('SELECT * FROM empresa_filtros(NULL,NULL,$1)',[grupo]))).rejects.toMatchObject({code:'P0002'})
      expect((await banco.comoUsuario(usuario,e=>e<{resultado:string}>("SELECT * FROM fila_reservar(NULL,'',NULL,NULL,NULL,NULL,NULL,$1)",[grupo]))).linhas[0].resultado).toBe('grupo_indisponivel')
    }
  }
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual([])
})
test('leitor comercial expõe metadados e contagens sem liberar tabelas administrativas',async()=>{
  const {lerGrupoProspeccao}=await import('@/src/server/grupos/prospeccao')
  await reservar(empresaA,grupo1)
  expect(await lerGrupoProspeccao(vendedor,grupo1)).toMatchObject({ok:true,grupo:{id:grupo1,nome:'Lista 1',descricao:'Resumo 1',origem:'Fonte 1',criterios:'Critério 1',total:2,disponiveis:1}})
  expect((await banco.comoUsuario(vendedor,e=>e('SELECT * FROM grupo_importacao'))).linhas).toEqual([])
  expect((await banco.comoUsuario(vendedor,e=>e('SELECT * FROM grupo_importacao_empresa'))).linhas).toEqual([])
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1',[grupo1])
  expect(await lerGrupoProspeccao(vendedor,grupo1)).toEqual({ok:false,motivo:'grupo_indisponivel'})
})
test('renovar reserva própria ignora a lista da próxima busca, inclusive desativada',async()=>{
  const a=await reservar(empresaA,grupo1)
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1',[grupo2])
  expect(await reservar(empresaA,grupo2,a.contexto)).toEqual(a)
  await banco.sql("UPDATE empresa_fila SET reservado_ate=now()-interval '1 second' WHERE empresa_id=$1",[empresaA])
  const renovada=await reservar(empresaA,grupo2,a.contexto)
  expect(renovada).toMatchObject({resultado:'ok',empresa_id:empresaA})
  expect(renovada.contexto).not.toBe(a.contexto)
})
test('senha provisória e inatividade negam escrita e não alteram reservas',async()=>{
  const a=await reservar(empresaA,grupo1)
  const antes=await banco.sql('SELECT * FROM empresa_fila')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[vendedor])
  await expect(reservar(empresaB,grupo1,a.contexto)).rejects.toMatchObject({code:'42501'})
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=false,ativo=false WHERE id=$1',[vendedor])
  await expect(reservar(empresaB,grupo1,a.contexto)).rejects.toMatchObject({code:'42501'})
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual(antes)
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[vendedor])
})

test('repositórios traduzem grupo indisponível sem executar recuperação geral',async()=>{
  const {consultarEmpresas,listarOpcoes}=await import('@/src/features/prospeccao/repositorio')
  const {reservarEmpresa}=await import('@/src/features/fila/repositorio')
  const filtros={nome:'',cnae:null,uf:null,cidade:null,bairro:null,pagina:1,grupo:grupo2}
  const a=await reservar(empresaA,grupo1)
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id=$1',[grupo2])
  expect(await consultarEmpresas(vendedor,filtros)).toEqual({ok:false,motivo:'grupo_indisponivel'})
  expect(await listarOpcoes(vendedor,null,null,grupo2)).toEqual({ok:false,motivo:'grupo_indisponivel'})
  expect(await reservarEmpresa(vendedor,empresaC,filtros,a.contexto)).toMatchObject({ok:true,resultado:'grupo_indisponivel',empresaId:empresaA,contexto:a.contexto})
})
test('contagem disponível respeita posse, reserva e descanso vigentes',async()=>{
  const {lerGrupoProspeccao}=await import('@/src/server/grupos/prospeccao')
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)',[empresaA,vendedor])
  await banco.sql("INSERT INTO empresa_fila(empresa_id,elegivel_em) VALUES ($1,now()+interval '1 day')",[empresaB])
  expect(await lerGrupoProspeccao(vendedor,grupo1)).toMatchObject({ok:true,grupo:{total:2,disponiveis:0}})
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[vendedor])
  await banco.sql("UPDATE empresa_fila SET elegivel_em=now()-interval '1 day' WHERE empresa_id=$1",[empresaB])
  expect(await lerGrupoProspeccao(gestor,grupo1)).toMatchObject({ok:true,grupo:{total:2,disponiveis:2}})
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[vendedor])
  await banco.sql("INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES ($1,$2,current_date,100,gen_random_uuid())",[empresaA,vendedor])
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[vendedor])
  expect(await lerGrupoProspeccao(gestor,grupo1)).toMatchObject({ok:true,grupo:{total:2,disponiveis:1}})
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[vendedor])
})
test('duas sessões com listas diferentes conservam a comparação de contexto',async()=>{
  const a=new Client({connectionString:banco.urlApp})
  const b=new Client({connectionString:banco.urlApp})
  await a.connect()
  await b.connect()
  try {
    for(const c of [a,b]) {
      await c.query('BEGIN')
      await c.query("SET LOCAL statement_timeout='5s'")
      await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('role','app_usuario',true)",[vendedor])
    }
    const primeira=await a.query("SELECT * FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,NULL,$2)",[empresaA,grupo1])
    const pendente=b.query("SELECT * FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,NULL,$2)",[empresaC,grupo2])
    await esperarReservaBloqueada()
    await a.query('COMMIT')
    expect((await pendente).rows[0]).toMatchObject({resultado:'contexto_alterado',contexto:primeira.rows[0].contexto})
    await b.query('COMMIT')
    expect(await banco.sql('SELECT empresa_id FROM empresa_fila WHERE reservado_por=$1',[vendedor])).toEqual([{empresa_id:empresaA}])
  } finally {await a.end()
    await b.end()}
})

async function catalogo(pagina=1,usuario=vendedor) {
  return (await banco.comoUsuario(usuario,e=>e<{id:string;nome:string;total:string;disponiveis:string}>('SELECT * FROM grupos_prospeccao_listar($1)',[pagina]))).linhas
}
test('catálogo comercial tem contagens distintas com overlap, cliente, posse, descanso e reserva própria',async()=>{
  const [{id:cliente}] = await banco.sql<{id:string}>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Cliente fictício','11987654321') RETURNING id")
  const [{id:carteira}] = await banco.sql<{id:string}>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Carteira fictícia','11987654321') RETURNING id")
  const [{id:descanso}] = await banco.sql<{id:string}>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Descanso fictício','11987654321') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT $1,unnest($2::uuid[])',[grupo1,[cliente,carteira,descanso]])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)',[cliente,vendedor])
  await banco.sql("INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES ($1,$2,current_date,100,gen_random_uuid())",[cliente,vendedor])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)',[carteira,vendedor])
  await banco.sql("INSERT INTO empresa_fila(empresa_id,elegivel_em) VALUES ($1,now()+interval '1 day')",[descanso])
  await reservar(empresaA,grupo1)
  const linhas=await catalogo()
  expect(linhas.find(g=>g.id===grupo1)).toMatchObject({total:'5',disponiveis:'1'})
  expect(linhas.find(g=>g.id===grupo2)).toMatchObject({total:'2',disponiveis:'2'})
  for(const linha of linhas) expect(Object.keys(linha).sort()).toEqual(['criado_em','criterios','descricao','disponiveis','id','nome','origem','total'])
  expect((await banco.comoUsuario(vendedor,e=>e('SELECT * FROM grupo_importacao'))).linhas).toEqual([])
  const {lerGrupoProspeccao,listarGruposProspeccao}=await import('@/src/server/grupos/prospeccao')
  expect(await listarGruposProspeccao(vendedor)).toMatchObject({ok:true,grupos:expect.arrayContaining([{id:grupo1,nome:'Lista 1',descricao:'Resumo 1',origem:'Fonte 1',criterios:'Critério 1',criadoEm:expect.any(String),total:5,disponiveis:1}]),temProxima:false})
  expect(await lerGrupoProspeccao(vendedor,grupo1)).toMatchObject({ok:true,grupo:{total:5,disponiveis:1}})
  await expect(banco.comoUsuario(vendedor,e=>e('SELECT * FROM grupo_prospeccao_contagens($1)',[grupo1]))).rejects.toMatchObject({code:'42501'})
})
test('catálogo pagina 21 linhas com desempate determinístico, vazias e desativadas',async()=>{
  const ids=Array.from({length:21},(_,i)=>`00000000-0000-4000-8000-${String(800+i).padStart(12,'0')}`)
  await banco.sql("INSERT INTO grupo_importacao(id,nome) SELECT unnest($1::uuid[]),'Lista antiga vazia'",[ids])
  expect((await banco.sql<{datas:number}>('SELECT count(DISTINCT criado_em)::int AS datas FROM grupo_importacao WHERE id=ANY($1::uuid[])',[ids]))[0].datas).toBe(1)
  await banco.sql("INSERT INTO grupo_importacao(nome,ativo) VALUES ('Desativada',false)")
  expect((await catalogo()).map(g=>g.id)).toEqual([...ids].reverse())
  const {listarGruposProspeccao}=await import('@/src/server/grupos/prospeccao')
  const primeira=await listarGruposProspeccao(vendedor)
  expect(primeira).toMatchObject({ok:true,temProxima:true})
  if(!primeira.ok) throw new Error('Leitura recusada')
  expect(primeira.grupos).toHaveLength(20)
  expect(primeira.grupos.every(g=>g.total===0&&g.disponiveis===0)).toBe(true)
  const segunda=await listarGruposProspeccao(vendedor,2)
  expect(segunda).toMatchObject({ok:true,temProxima:false})
  if(!segunda.ok) throw new Error('Leitura recusada')
  expect(segunda.grupos).toHaveLength(3)
  expect(segunda.grupos[0].id).toBe(ids[0])
  expect(segunda.grupos.some(g=>primeira.grupos.some(p=>p.id===g.id))).toBe(false)
  for(const pagina of [0,-1,null,10001]) await expect(banco.comoUsuario(vendedor,e=>e('SELECT * FROM grupos_prospeccao_listar($1)',[pagina]))).rejects.toMatchObject({code:'22023'})
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1',[vendedor])
  expect(await listarGruposProspeccao(vendedor)).toEqual({ok:false,motivo:'sem_permissao'})
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[vendedor])
})
