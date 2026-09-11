import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { Client } from 'pg'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let eu: string
let outro: string
let numero = 0
const filtros = ['', null, null, null, null]
const reservar = async (alvo: string | null, contexto: string | null = null, usuario = eu, busca: unknown[] = filtros) => {
  const r = await banco.comoUsuario(usuario, e => e<{resultado:string;empresa_id:string|null;reservado_ate:Date|null;contexto:string|null}>(
    'SELECT * FROM fila_reservar($1,$2,$3,$4,$5,$6,$7)',[alvo,...busca,contexto]))
  return r.linhas[0]
}
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco,'vendedor','ReservaEu')
  outro = await criarUsuario(banco,'vendedor','ReservaOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  // Contexto pode ainda não existir durante a rodada RED.
  await banco.sql("DO $$ BEGIN IF to_regclass('fila_contexto') IS NOT NULL THEN DELETE FROM fila_contexto; END IF; END $$")
})
async function empresa(nome = 'Empresa') {
  const [r] = await banco.sql<{id:string}>(`INSERT INTO empresa (cnpj,razao_social,telefone) VALUES ($1,$2,'11987654321') RETURNING id`,[String(++numero).padStart(14,'0'),nome])
  return r.id
}

test('reserva alvo, retorna contexto e repetir mesma empresa não renova', async () => {
  const id = await empresa()
  const a = await reservar(id)
  expect(a).toMatchObject({resultado:'ok',empresa_id:id,contexto:expect.any(String),reservado_ate:expect.any(Date)})
  expect(await reservar(id,a.contexto)).toEqual(a)
  expect(await reservar(id,null)).toMatchObject({resultado:'contexto_alterado',empresa_id:null,reservado_ate:null})
})
test('sem candidata e indisponível preservam reserva, prazo, contexto e histórico', async () => {
  const id = await empresa()
  const a = await reservar(id)
  const antes = await banco.sql('SELECT * FROM empresa_fila')
  expect(await reservar(null,a.contexto)).toMatchObject({resultado:'sem_candidata',empresa_id:null})
  const alheia = await empresa()
  await reservar(alheia,null,outro)
  expect(await reservar(alheia,a.contexto)).toMatchObject({resultado:'indisponivel',empresa_id:null})
  expect(await banco.sql('SELECT * FROM empresa_fila WHERE empresa_id=$1',[id])).toEqual(antes)
  expect(await banco.sql('SELECT * FROM contato')).toEqual([])
})
test('troca automática filtra e exclui anterior; escolha explícita independe do filtro', async () => {
  const a = await reservar(await empresa('Anterior'))
  const id = await empresa('Ação')
  await empresa('Outro')
  expect(await reservar(null,a.contexto,eu,['sem resultado',null,null,null,null])).toMatchObject({resultado:'sem_candidata'})
  const b = await reservar(null,a.contexto,eu,['ACAO',null,null,null,null])
  expect(b).toMatchObject({resultado:'ok',empresa_id:id})
  expect(b.contexto).not.toBe(a.contexto)
  const escolhida = await empresa('Escolhida')
  expect(await reservar(escolhida,b.contexto,eu,['incompatível',null,null,null,null])).toMatchObject({resultado:'ok',empresa_id:escolhida})
  expect(await banco.sql('SELECT elegivel_em FROM empresa_fila WHERE empresa_id=$1',[a.empresa_id])).toEqual([{elegivel_em:null}])
})
test('reserva expirada exige nova aquisição explícita e mantém primeira_reserva_em', async () => {
  const id = await empresa()
  const a = await reservar(id)
  const antes = await banco.sql('SELECT primeira_reserva_em FROM empresa_fila WHERE empresa_id=$1',[id])
  await banco.sql("UPDATE empresa_fila SET reservado_ate=clock_timestamp()-interval '1 second' WHERE empresa_id=$1",[id])
  const b = await reservar(id,a.contexto)
  expect(b.resultado).toBe('ok')
  expect(b.contexto).not.toBe(a.contexto)
  expect(await banco.sql('SELECT primeira_reserva_em FROM empresa_fila WHERE empresa_id=$1',[id])).toEqual(antes)
})
test('carteira própria, posse ativa, reserva alheia e descanso não viram reserva', async () => {
  for (const dono of [eu,outro]) {
    const id = await empresa()
    await banco.sql('INSERT INTO empresa_fila (empresa_id,vendedor_id) VALUES ($1,$2)',[id,dono])
    expect((await reservar(id)).resultado).toBe('indisponivel')
  }
  const id = await empresa()
  await banco.sql("INSERT INTO empresa_fila (empresa_id,elegivel_em) VALUES ($1,clock_timestamp()+interval '1 hour')",[id])
  expect((await reservar(id)).resultado).toBe('indisponivel')
})
test('contato que assume invalida contexto até quando reserva fica vazia (ABA)', async () => {
  const a = await reservar(await empresa())
  await banco.comoUsuario(eu,e=>e("SELECT contato_registrar($1,'interessado',NULL,NULL,NULL,'assumir')",[a.empresa_id]))
  expect((await reservar(await empresa(),a.contexto)).resultado).toBe('contexto_alterado')
  expect((await reservar(null,null)).resultado).toBe('contexto_alterado')
  expect(await banco.sql('SELECT count(*)::int AS n FROM contato')).toEqual([{n:1}])
})
test('permissões e parâmetros não provocam mutações', async () => {
  await expect(reservar(null,null,eu,['x'.repeat(101),null,null,null,null])).rejects.toMatchObject({code:'22023'})
  await expect(banco.sql("SELECT * FROM fila_reservar(NULL,'',NULL,NULL,NULL,NULL,NULL)")).rejects.toMatchObject({code:'42501'})
  const pendente = await criarUsuario(banco,'vendedor','ReservaPendente')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1',[pendente])
  await expect(reservar(await empresa(),null,pendente)).rejects.toMatchObject({code:'42501'})
})

test('repositório e leitura entregam contexto inclusive depois de consumir reserva', async () => {
  const { reservarEmpresa } = await import('@/src/features/fila/repositorio')
  const { lerMinhasEmpresas } = await import('@/src/features/fila/consulta')
  expect(await lerMinhasEmpresas(eu)).toEqual({ok:true,reserva:null,carteira:[],contexto:null})
  const id = await empresa()
  const a = await reservarEmpresa(eu,id,{nome:'',cnae:null,uf:null,cidade:null,bairro:null},null)
  expect(a).toMatchObject({ok:true,resultado:'ok',empresaId:id,contexto:expect.any(String)})
  if (!a.ok) throw new Error('esperava sucesso')
  expect(await lerMinhasEmpresas(eu)).toMatchObject({ok:true,contexto:a.contexto,reserva:{id}})
  await banco.comoUsuario(eu,e=>e("SELECT contato_registrar($1,'nao_atendeu',NULL,NULL,NULL,'devolver')",[id]))
  const leitura = await lerMinhasEmpresas(eu)
  expect(leitura).toMatchObject({ok:true,reserva:null,carteira:[],contexto:expect.any(String)})
  if (leitura.ok) expect(leitura.contexto).not.toBe(a.contexto)
})

async function conexao(usuario: string, admin = false) {
  const c = new Client({connectionString:admin ? banco.urlAdmin : banco.urlApp,ssl:false})
  await c.connect()
  await c.query('BEGIN')
  await c.query("SET LOCAL statement_timeout='5s'")
  await c.query("SELECT set_config('app.usuario_id',$1,true),set_config('role','app_usuario',true)",[usuario])
  return c
}
const chamar = (c: Client, alvo: string | null, contexto: string | null) =>
  c.query('SELECT * FROM fila_reservar($1,$2,$3,$4,$5,$6,$7)',[alvo,...filtros,contexto])
async function aguardandoAdvisory(pid: number) {
  for (let i = 0; i < 100; i++) {
    const [r] = await banco.sql<{esperando:boolean}>("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='advisory') AS esperando",[pid])
    if (r.esperando) return
  }
  throw new Error('a conexão não chegou à barreira advisory em 100 consultas')
}
test('duas conexões do mesmo usuário: segunda espera advisory e recusa contexto antigo', async () => {
  const id = await empresa()
  const seguinte = await empresa()
  const a = await conexao(eu)
  const b = await conexao(eu)
  try {
    const primeira = await chamar(a,id,null)
    const [{pid}] = (await b.query('SELECT pg_backend_pid() AS pid')).rows
    const pendente = chamar(b,seguinte,null)
    await aguardandoAdvisory(pid)
    await a.query('COMMIT')
    expect((await pendente).rows[0]).toMatchObject({resultado:'contexto_alterado',empresa_id:null})
    await b.query('COMMIT')
    expect(await banco.sql('SELECT empresa_id FROM empresa_fila WHERE reservado_por=$1',[eu])).toEqual([{empresa_id:primeira.rows[0].empresa_id}])
  } finally { await a.end(); await b.end() }
})
test('dois vendedores disputam alvo: candidato bloqueado não espera nem duplica reserva', async () => {
  const id = await empresa()
  const a = await conexao(eu)
  const b = await conexao(outro)
  try {
    expect((await chamar(a,id,null)).rows[0].resultado).toBe('ok')
    expect((await chamar(b,id,null)).rows[0].resultado).toBe('indisponivel')
    await a.query('COMMIT')
    await b.query('COMMIT')
    expect(await banco.sql('SELECT reservado_por FROM empresa_fila WHERE empresa_id=$1',[id])).toEqual([{reservado_por:eu}])
  } finally { await a.end(); await b.end() }
})
test('contato espera troca do mesmo usuário e não registra na reserva antiga', async () => {
  const antiga = await reservar(await empresa())
  const nova = await empresa()
  const a = await conexao(eu)
  const b = await conexao(eu)
  try {
    await chamar(a,nova,antiga.contexto)
    const [{pid}] = (await b.query('SELECT pg_backend_pid() AS pid')).rows
    const pendente = b.query("SELECT contato_registrar($1,'nao_atendeu',NULL,NULL,NULL,'nenhum')",[antiga.empresa_id]).then(r=>r,erro=>erro)
    await aguardandoAdvisory(pid)
    await a.query('COMMIT')
    expect(await pendente).toMatchObject({code:'42501'})
    await b.query('ROLLBACK')
    expect(await banco.sql('SELECT * FROM contato')).toEqual([])
  } finally { await a.end(); await b.end() }
})

test('trocas cruzadas de reservas expiradas não aguardam locks de empresa', async () => {
  const primeira = await reservar(await empresa())
  const segunda = await reservar(await empresa(),null,outro)
  await banco.sql("UPDATE empresa_fila SET reservado_ate=clock_timestamp()-interval '1 second'")
  const a = await conexao(eu,true)
  const b = await conexao(outro,true)
  try {
    // Somente o bloqueio de preparação usa a dona; as chamadas usam app_usuario.
    await a.query('RESET ROLE')
    await b.query('RESET ROLE')
    await a.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE',[primeira.empresa_id])
    await b.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE',[segunda.empresa_id])
    await a.query('SET LOCAL ROLE app_usuario')
    await b.query('SET LOCAL ROLE app_usuario')
    expect((await chamar(a,segunda.empresa_id,primeira.contexto)).rows[0].resultado).toBe('indisponivel')
    expect((await chamar(b,primeira.empresa_id,segunda.contexto)).rows[0].resultado).toBe('indisponivel')
    await a.query('COMMIT')
    await b.query('COMMIT')
    expect(await banco.sql('SELECT empresa_id FROM empresa_fila WHERE reservado_por=$1',[eu])).toEqual([{empresa_id:primeira.empresa_id}])
  } finally { await a.end(); await b.end() }
})
test('contato que expira na espera é recusado depois do lock', async () => {
  const a = await reservar(await empresa())
  const bloqueio = await conexao(eu)
  const cliente = await conexao(eu)
  try {
    await bloqueio.query('SELECT pg_advisory_xact_lock(hashtextextended($1,25))',[eu])
    const [{pid}] = (await cliente.query('SELECT pg_backend_pid() AS pid')).rows
    const pendente = cliente.query("SELECT contato_registrar($1,'nao_atendeu',NULL,NULL,NULL,'nenhum') AS resultado",[a.empresa_id])
    await aguardandoAdvisory(pid)
    await banco.sql("UPDATE empresa_fila SET reservado_ate=clock_timestamp()-interval '1 second' WHERE empresa_id=$1",[a.empresa_id])
    await bloqueio.query('COMMIT')
    expect((await pendente).rows).toEqual([{resultado:'reserva_expirada'}])
    await cliente.query('COMMIT')
    expect(await banco.sql('SELECT * FROM contato')).toEqual([])
  } finally { await bloqueio.end(); await cliente.end() }
})
test('contexto só é legível pelo próprio e funções internas não são concedidas', async () => {
  const a = await reservar(await empresa())
  expect((await banco.comoUsuario(outro,e=>e('SELECT * FROM fila_contexto'))).linhas).toEqual([])
  expect((await banco.comoUsuario(eu,e=>e('SELECT versao FROM fila_contexto'))).linhas).toEqual([{versao:a.contexto}])
  await expect(banco.comoUsuario(eu,e=>e('UPDATE fila_contexto SET versao=gen_random_uuid()'))).rejects.toMatchObject({code:'42501'})
  await expect(banco.comoUsuario(eu,e=>e('SELECT * FROM fila_puxar()'))).rejects.toMatchObject({code:'42501'})
  await expect(banco.comoUsuario(eu,e=>e("SELECT contato_registrar_interno($1,'nao_atendeu',NULL,NULL,NULL,'nenhum')",[a.empresa_id]))).rejects.toMatchObject({code:'42501'})
  expect(await banco.sql(`SELECT p.proname FROM pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.proname IN ('fila_reservar','fila_puxar','contato_registrar','contato_registrar_interno') AND a.grantee=0 AND a.privilege_type='EXECUTE'`)).toEqual([])
})
test.each(['%','_','\\'])('seleção automática trata %s literalmente', async caractere => {
  await empresa('Nome comum')
  const id = await empresa(`Nome ${caractere} literal`)
  expect((await reservar(null,null,eu,[caractere,null,null,null,null])).empresa_id).toBe(id)
})
test('CNAE e localização combinam AND na seleção automática', async () => {
  await banco.sql("INSERT INTO cep (cep,localidade,uf,ibge,bairro) VALUES ('01000000','Cidade','SP','3550308','Centro') ON CONFLICT DO NOTHING")
  await empresa('Sem dados')
  const id = await empresa('Com dados')
  await banco.sql("UPDATE empresa SET cnae_principal='1234567',cep='01000000' WHERE id=$1",[id])
  expect((await reservar(null,null,eu,['','1234567','RJ','3550308','Centro'])).resultado).toBe('sem_candidata')
  expect((await reservar(null,null,eu,['','1234567','SP','3550308','Centro'])).empresa_id).toBe(id)
})
