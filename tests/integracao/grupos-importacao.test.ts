import { confirmarImportacaoHistorica } from './fixtures/importacao-historica'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let outroGestor: string
let vendedor: string
let numero = 0
function cnpjUnico() {
  let base = String(++numero).padStart(12, '0')
  for (let rodada = 0; rodada < 2; rodada++) {
    let soma = 0
    for (let i = base.length - 1, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1) soma += (base.charCodeAt(i) - 48) * peso
    const resto = soma % 11
    base += String(resto < 2 ? 0 : 11 - resto)
  }
  return base
}
const linha = () => ({ cnpj: cnpjUnico(), razao_social: 'Empresa original', telefone: '11999999999', cnae_principal: '1234567' })
const sqlConfirmar = 'SELECT * FROM grupo_importacao_confirmar($1,$2,$3,$4,$5,$6,$7)'
const parametros = (linhas: unknown, chave = randomUUID()) => [chave, 'Mooca', 'mooca.xlsx', 'a'.repeat(64), JSON.stringify(linhas), JSON.stringify({ total: 2 }), JSON.stringify({ descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null })]
async function confirmar(linhas: unknown, chave = randomUUID(), usuario = gestor) {
  const r = await confirmarImportacaoHistorica<{grupo_id:string; inseridas:number; vinculadas:number; relatorio:unknown}>(banco, usuario, parametros(linhas, chave))
  return r.linhas[0]
}
const situacao = (id: string, ativo: boolean, usuario = gestor) => banco.comoUsuario(usuario, e => e('SELECT grupo_importacao_situacao_definir($1,$2) AS resultado', [id, ativo]))
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'GrupoGestor')
  outroGestor = await criarUsuario(banco, 'gestor', 'GrupoOutro')
  vendedor = await criarUsuario(banco, 'vendedor', 'GrupoVendedor')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM empresa_atendimento_operacao; DELETE FROM empresa_vinculo; DELETE FROM negociacao')
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM fila_contexto')
  await banco.sql("DO $$ BEGIN IF to_regclass('grupo_importacao_empresa') IS NOT NULL THEN DELETE FROM grupo_importacao_empresa; DELETE FROM grupo_importacao; END IF; END $$")
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM empresa')
})

test('banco vazio não cria Base de testes; novas empresas pertencem só ao grupo confirmado', async () => {
  expect(await banco.sql('SELECT * FROM grupo_importacao')).toEqual([])
  const r = await confirmar([linha()])
  expect(r).toMatchObject({ inseridas: 1, vinculadas: 1 })
  expect(await banco.sql('SELECT grupo_id FROM grupo_importacao_empresa')).toEqual([{ grupo_id: r.grupo_id }])
})
test('dois grupos compartilham CNPJ sem duplicar ou sobrescrever empresa', async () => {
  const existente = linha()
  await confirmar([existente])
  const r = await confirmar([existente, linha()])
  expect(r).toMatchObject({ inseridas: 1, vinculadas: 2 })
  expect(await banco.sql('SELECT razao_social FROM empresa WHERE cnpj=$1', [existente.cnpj])).toEqual([{ razao_social: 'Empresa original' }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{ n: 2 }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao_empresa')).toEqual([{ n: 3 }])
})
test('repetição preserva resultado inclusive após renomeação; divergência de identidade ou payload é negada', async () => {
  const chave = randomUUID()
  const linhas = [linha()]
  const r = await confirmar(linhas, chave)
  await banco.comoUsuario(gestor, e => e("SELECT grupo_importacao_renomear($1,'Renomeado')", [r.grupo_id]))
  expect(await confirmar(linhas, chave)).toEqual(r)
  await expect(confirmar(linhas, chave, outroGestor)).rejects.toMatchObject({ code: '22023' })
  const reanalisado = parametros(linhas, chave)
  reanalisado[5] = JSON.stringify({novas:0, jaCadastradas:1})
  expect((await confirmarImportacaoHistorica(banco, gestor, reanalisado)).linhas[0]).toEqual(r)
  for (const [indice, valor] of [[1, 'Outro'], [2, 'outro.xlsx'], [3, 'b'.repeat(64)], [4, JSON.stringify([linha()])]] as const) {
    const p = parametros(linhas, chave)
    p[indice] = valor
    await expect(confirmarImportacaoHistorica(banco, gestor, p)).rejects.toMatchObject({ code: '22023' })
  }
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})
test('vendedor não lê nem administra grupos e helpers internos não são concedidos', async () => {
  const r = await confirmar([linha()])
  expect((await banco.comoUsuario(vendedor, e => e('SELECT * FROM grupo_importacao'))).linhas).toEqual([])
  expect((await banco.comoUsuario(vendedor, e => e('SELECT * FROM grupo_importacao_empresa'))).linhas).toEqual([])
  await expect(confirmar([linha()], randomUUID(), vendedor)).rejects.toMatchObject({ code: '42501' })
  await expect(situacao(r.grupo_id, false, vendedor)).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(vendedor, e => e("SELECT grupo_importacao_renomear($1,'X')", [r.grupo_id]))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(gestor, e => e("UPDATE grupo_importacao SET ativo=false"))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(gestor, e => e('SELECT empresa_origem_ativa($1)', [randomUUID()]))).rejects.toMatchObject({ code: '42501' })
})

test('helper comum de filtros existe sem execução para aplicação, mesmo escolhendo universo administrativo', async () => {
  expect(await banco.sql("SELECT has_function_privilege('app_usuario','empresa_filtros_interno(text,text,boolean)','EXECUTE') AS concedido")).toEqual([{concedido:false}])
  for (const usuario of [gestor,vendedor]) {
    for (const administracao of [true,false]) {
      await expect(banco.comoUsuario(usuario,e=>e('SELECT * FROM empresa_filtros_interno(NULL,NULL,$1)',[administracao]))).rejects.toMatchObject({code:'42501'})
    }
  }
})

test('filtros públicos conservam geografia, ordenação e universos distintos com validação comum', async () => {
  await banco.sql("INSERT INTO cep(cep,bairro,localidade,uf,ibge) VALUES ('01310999','  Centro  ','Cidade do cenário','SP','3550308')")
  const grupo = await confirmar([{...linha(),cep:'01310999'}])
  const esperadas = [
    {tipo:'cnae',valor:'1234567',rotulo:'1234567'},
    {tipo:'bairro',valor:'Centro',rotulo:'Centro'},
    {tipo:'cidade',valor:'3550308',rotulo:'Cidade do cenário'},
    {tipo:'uf',valor:'SP',rotulo:'SP'},
  ]
  for (const funcao of ['empresa_filtros_administracao']) {
    expect((await banco.comoUsuario(gestor,e=>e(`SELECT * FROM ${funcao}('SP','3550308')`))).linhas).toEqual(esperadas)
    for (const params of [['sp',null],[null,'3550308'],['SP','abc']]) {
      await expect(banco.comoUsuario(gestor,e=>e(`SELECT * FROM ${funcao}($1,$2)`,params))).rejects.toMatchObject({code:'22023'})
    }
  }
  await expect(banco.comoUsuario(vendedor,e=>e("SELECT * FROM empresa_filtros_administracao('sp',NULL)"))).rejects.toMatchObject({code:'42501'})
  await situacao(grupo.grupo_id,false)
  await expect(banco.comoUsuario(gestor,e=>e("SELECT * FROM empresa_filtros('SP','3550308')"))).rejects.toMatchObject({code:'42501'})
  expect((await banco.comoUsuario(gestor,e=>e("SELECT * FROM empresa_filtros_administracao('SP','3550308')"))).linhas).toEqual(esperadas)
})
test('gestor inativo ou com senha pendente não confirma nem muda grupo', async () => {
  const r = await confirmar([linha()])
  for (const campo of ['ativo=false', 'senha_provisoria_pendente=true']) {
    await banco.sql(`UPDATE usuario SET ${campo} WHERE id=$1`, [outroGestor])
    await expect(confirmar([linha()], randomUUID(), outroGestor)).rejects.toMatchObject({ code: '42501' })
    await expect(situacao(r.grupo_id, false, outroGestor)).rejects.toMatchObject({ code: '42501' })
    await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false WHERE id=$1', [outroGestor])
  }
})
test('payload inválido ou duplicado desfaz grupo, vínculos e inserções inclusive para CNPJ existente', async () => {
  const existente = linha()
  await confirmar([existente])
  const antes = await banco.sql('SELECT * FROM empresa ORDER BY id')
  for (const linhas of [[], {}, Array.from({length:5001}, linha), [linha(), { ...linha(), telefone: 'x' }], [existente, existente], [{...existente, telefone:'x'}], [null], [{...linha(), cnpj:null}]]) {
    await expect(confirmar(linhas)).rejects.toBeDefined()
    expect(await banco.sql('SELECT * FROM empresa ORDER BY id')).toEqual(antes)
    expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
  }
  for (const [i, valor] of [[0, null], [1, ''], [1, 'x'.repeat(101)], [1, 'a\nb'], [2, ''], [2, 'x'.repeat(256)], [3, 'x'], [5, '[]']] as const) {
    const p: unknown[] = parametros([linha()])
    p[i] = valor
    await expect(confirmarImportacaoHistorica(banco, gestor, p)).rejects.toMatchObject({code:'22023'})
  }
})
async function prepararVinculo(id:string) {
 await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')",[id,vendedor])
}
const iniciar=(id:string)=>banco.comoUsuario(vendedor,e=>e<{r:{ok:boolean;motivo?:string}}>('SELECT atendimento_iniciar($1,gen_random_uuid(),(SELECT versao FROM empresa_vinculo WHERE empresa_id=$1)) AS r',[id])).then(r=>r.linhas[0].r)
test('desativar origem recusa nova intenção e mantém leitura histórica autorizada e administração',async()=>{
 const g=await confirmar([linha()]),[{id}]=await banco.sql<{id:string}>('SELECT id FROM empresa')
 await prepararVinculo(id);await situacao(g.grupo_id,false)
 expect(await iniciar(id)).toEqual({ok:false,motivo:'desatualizada'})
 expect((await banco.comoUsuario(vendedor,e=>e('SELECT id FROM empresa'))).linhas).toEqual([{id}])
 expect((await banco.comoUsuario(gestor,e=>e('SELECT id FROM empresa'))).linhas).toEqual([{id}])
 expect((await banco.comoUsuario(gestor,e=>e('SELECT * FROM empresa_filtros_administracao(NULL,NULL)'))).linhas).toHaveLength(1)
})
test('outra origem ativa mantém disponibilidade; reativação não altera vínculo nem história',async()=>{
 const l=linha(),a=await confirmar([l]),b=await confirmar([l]),[{id}]=await banco.sql<{id:string}>('SELECT id FROM empresa')
 await prepararVinculo(id);await situacao(a.grupo_id,false)
 expect(await iniciar(id)).toMatchObject({ok:true})
 const antes=await banco.sql('SELECT * FROM empresa_vinculo')
 await situacao(b.grupo_id,false)
 expect(await iniciar(id)).toEqual({ok:false,motivo:'desatualizada'})
 await situacao(b.grupo_id,true)
 expect(await banco.sql('SELECT * FROM empresa_vinculo')).toEqual(antes)
 expect(await iniciar(id)).toMatchObject({ok:true})
})

test('limites medem o texto completo recebido; espaços externos não burlam nome e arquivo', async () => {
  for (const [indice,valor] of [[1, ' '+ 'x'.repeat(100)], [2,' '+ 'x'.repeat(255)]] as const) {
    const p = parametros([linha()])
    p[indice] = valor
    await expect(confirmarImportacaoHistorica(banco, gestor, p)).rejects.toMatchObject({code:'22023'})
  }
})

test('erro de banco após primeira inserção desfaz toda a confirmação', async () => {
  const a = linha()
  const b = linha()
  await banco.sql(`ALTER TABLE empresa ADD CONSTRAINT empresa_falha_cenario CHECK (cnpj <> '${b.cnpj}')`)
  try {
    await expect(confirmar([a,b])).rejects.toMatchObject({code:'23514'})
    expect(await banco.sql('SELECT * FROM grupo_importacao')).toEqual([])
    expect(await banco.sql('SELECT * FROM grupo_importacao_empresa')).toEqual([])
    expect(await banco.sql('SELECT * FROM empresa')).toEqual([])
  } finally { await banco.sql('ALTER TABLE empresa DROP CONSTRAINT empresa_falha_cenario') }
})

test('mutações têm retorno explícito, auditoria e FK impede remover grupo ou empresa vinculados', async () => {
  const r = await confirmar([linha()])
  expect((await situacao(randomUUID(),false)).linhas).toEqual([{resultado:'nao_encontrado'}])
  expect((await banco.comoUsuario(gestor,e=>e('SELECT grupo_importacao_renomear($1,$2) AS resultado',[randomUUID(),'Ausente']))).linhas).toEqual([{resultado:'nao_encontrado'}])
  await banco.comoUsuario(outroGestor,e=>e('SELECT grupo_importacao_renomear($1,$2)',[r.grupo_id,'Nome diferente']))
  expect(await banco.sql('SELECT nome,criado_por,atualizado_por FROM grupo_importacao')).toEqual([{nome:'Nome diferente',criado_por:gestor,atualizado_por:outroGestor}])
  const [{server_version_num}] = await banco.sql<{server_version_num:string}>('SHOW server_version_num')
  const versao = Math.floor(Number(server_version_num) / 10000)
  expect([17,18]).toContain(versao)
  // PG18 distingue RESTRICT (23001); PG17 usa foreign_key_violation (23503).
  const codigoRestrict = versao === 18 ? '23001' : '23503'
  const grupos = await banco.sql('SELECT * FROM grupo_importacao')
  const empresas = await banco.sql<{id:string}>('SELECT * FROM empresa')
  const vinculos = await banco.sql('SELECT * FROM grupo_importacao_empresa')
  expect(grupos).toHaveLength(1)
  expect(empresas).toHaveLength(1)
  expect(vinculos).toEqual([expect.objectContaining({grupo_id:r.grupo_id,empresa_id:empresas[0].id})])
  await expect(banco.sql('DELETE FROM grupo_importacao WHERE id=$1',[r.grupo_id])).rejects.toMatchObject({code:codigoRestrict,constraint:'grupo_importacao_empresa_grupo_id_fkey',schema:'public',table:'grupo_importacao_empresa'})
  await expect(banco.sql('DELETE FROM empresa WHERE id=$1',[empresas[0].id])).rejects.toMatchObject({code:codigoRestrict,constraint:'grupo_importacao_empresa_empresa_id_fkey',schema:'public',table:'grupo_importacao_empresa'})
  expect(await banco.sql('SELECT * FROM grupo_importacao')).toEqual(grupos)
  expect(await banco.sql('SELECT * FROM empresa')).toEqual(empresas)
  expect(await banco.sql('SELECT * FROM grupo_importacao_empresa')).toEqual(vinculos)
  await expect(banco.sql(sqlConfirmar,parametros([linha()]))).rejects.toMatchObject({code:'42501'})
})

async function conexao(usuario: string, historica = false) {
  const c = new Client({connectionString:historica ? banco.urlAdmin : banco.urlApp,ssl:false})
  await c.connect()
  await c.query('BEGIN')
  await c.query("SET LOCAL statement_timeout='8s'")
  await c.query("SELECT set_config('app.usuario_id',$1,true)", [usuario])
  if (!historica) await c.query('SET LOCAL ROLE app_usuario')
  return c
}
async function esperarLock(pid: number) {
  for (let i=0;i<150;i++) {
    const [{esperando}] = await banco.sql<{esperando:boolean}>("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) AS esperando", [pid])
    if (esperando) return
  }
  throw new Error('operação não esperou advisory')
}

test('confirmações concorrentes com mesma chave aguardam e retornam exatamente um grupo', async () => {
  const p = parametros([linha()])
  const a = await conexao(gestor, true)
  const b = await conexao(gestor, true)
  try {
    const primeira = (await a.query(sqlConfirmar,p)).rows
    const [{pid}] = (await b.query('SELECT pg_backend_pid() AS pid')).rows
    const pendente = b.query(sqlConfirmar,p)
    await esperarLock(pid)
    await a.query('COMMIT')
    expect((await pendente).rows).toEqual(primeira)
    await b.query('COMMIT')
    expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{n:1}])
    expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{n:1}])
  } finally { await a.end(); await b.end() }
})
test.each(['atendimento', 'desativacao'])('concorrência real: %s conclui primeiro', async primeira => {
  const r = await confirmar([linha()])
  const [{id}] = await banco.sql<{id:string}>('SELECT id FROM empresa')
  const a = await conexao(vendedor)
  const b = await conexao(gestor)
  await prepararVinculo(id)
  const reservarSql = 'SELECT atendimento_iniciar($1,gen_random_uuid(),1) AS r'
  try {
    if (primeira === 'atendimento') {
      const reserva = (await a.query(reservarSql, [id])).rows[0]
      const [{pid}] = (await b.query('SELECT pg_backend_pid() AS pid')).rows
      const pendente = b.query('SELECT grupo_importacao_situacao_definir($1,false)', [r.grupo_id])
      await esperarLock(pid)
      await a.query('COMMIT')
      await pendente
      await b.query('COMMIT')
      expect(reserva.r).toMatchObject({ok:true})
      expect(await iniciar(id)).toEqual({ok:false,motivo:'desatualizada'})
    } else {
      await b.query('SELECT grupo_importacao_situacao_definir($1,false)', [r.grupo_id])
      const [{pid}] = (await a.query('SELECT pg_backend_pid() AS pid')).rows
      const pendente = a.query(reservarSql, [id])
      await esperarLock(pid)
      await b.query('COMMIT')
      expect((await pendente).rows[0].r).toEqual({ok:false,motivo:'desatualizada'})
      await a.query('COMMIT')
    }
  } finally { await a.end(); await b.end() }
})
