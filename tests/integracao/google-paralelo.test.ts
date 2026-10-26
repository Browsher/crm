import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { setTimeout as aguardar } from 'node:timers/promises'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let outroGestor: string
let vendedores: string[]
let dia: string
let agora: string
const executores = Array.from({ length: 4 }, () => randomUUID())
type Pedido = { id: string; vendedor_id: string; execucao_id: string; revisao: number; snapshot: unknown; snapshot_sha256: string; contrato: number }
type Retorno = { pedido: Pedido | null; ocupado?: boolean; sincronizar?: string }
const chamar = (quem: string, sql: string, valores: unknown[] = []) => banco.comoUsuario(quem, e => e(sql, valores)).then(r => r.linhas)
const reivindicar = (executor: string, autor = gestor) => banco.sql<{ r: Retorno }>("SELECT google_coordenar_em($2,$3::timestamptz) AS r FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) identidade", [autor, executor, agora]).then(r => r[0].r)
async function plano(vendedor: string, sincronizado = true) {
  const [{ id }] = await chamar(vendedor, "SELECT google_planejar($1,'Brinquedos','Centro','São Paulo','SP') AS id", [dia]) as { id: string }[]
  if (sincronizado) {
    const [{ p }] = await chamar(gestor, "SELECT google_planilha_preparar($1,'fixture-paralelo:123') AS p", [id]) as { p: { versao: number } }[]
    await chamar(gestor, 'SELECT google_planilha_confirmar($1,$2,NULL)', [id, p.versao])
  }
  return id
}

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Paralelo Gestor')
  outroGestor = await criarUsuario(banco, 'gestor', 'Paralelo Outro Gestor')
  vendedores = await Promise.all(Array.from({ length: 4 }, (_, i) => criarUsuario(banco, 'vendedor', 'Paralelo ' + i)))
  const [data] = await banco.sql<{ dia: string; agora: string }>("SELECT to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '14 days','YYYY-MM-DD') AS dia,to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '11 days','YYYY-MM-DD')||'T17:00:00-03:00' AS agora")
  dia = data.dia
  agora = data.agora
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  for (const tabela of ['google_execucao','google_exclusividade','google_resultado','google_publicacao','google_planilha_tentativa','google_sincronizacao','google_planejamento','google_rotina','empresa_origem_google','google_grupo','grupo_importacao_empresa','grupo_importacao','empresa_fila','empresa']) await banco.sql('DELETE FROM ' + tabela)
})

test('admite tres vendedores e recusa a quarta reivindicacao concorrente', async () => {
  for (const vendedor of vendedores) await plano(vendedor)
  const respostas = await Promise.all(executores.map(id => reivindicar(id)))
  expect(respostas.filter(r => r.pedido)).toHaveLength(3)
  expect(respostas.filter(r => r.ocupado)).toHaveLength(1)
  expect(new Set(respostas.flatMap(r => r.pedido ? [r.pedido.vendedor_id] : [])).size).toBe(3)
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_execucao WHERE concluido_em IS NULL')).toEqual([{ n: 3 }])
  for (let i = 0; i < respostas.length; i++) if (respostas[i].pedido) expect((await reivindicar(executores[i])).pedido).toEqual(respostas[i].pedido)
})

test('retomada e privada e falha de uma posicao nao bloqueia outros vendedores', async () => {
  for (const vendedor of vendedores) await plano(vendedor)
  const a = (await reivindicar(executores[0])).pedido!
  expect(await reivindicar(executores[0], outroGestor)).toMatchObject({ pedido: null, ocupado: true })
  await expect(chamar(gestor, "SELECT google_agente_etapa($1,'falhou','fixture',$2)", [a.id, executores[1]])).rejects.toMatchObject({ code: '55000' })
  await chamar(gestor, "SELECT google_agente_etapa($1,'falhou','fixture',$2)", [a.id, executores[0]])
  await chamar(a.vendedor_id, "SELECT google_planejar($1,'Pet shops','','São Paulo','SP')", [dia])
  const [b, c] = await Promise.all([reivindicar(executores[1]), reivindicar(executores[2])])
  expect(b.pedido).not.toBeNull()
  expect(c.pedido).not.toBeNull()
  expect(new Set([a.vendedor_id, b.pedido!.vendedor_id, c.pedido!.vendedor_id]).size).toBe(3)
  expect((await reivindicar(executores[0])).pedido).toMatchObject({ id: a.id, revisao: a.revisao, snapshot: a.snapshot, snapshot_sha256: a.snapshot_sha256 })
})

test('plano sem espelho confirmado nao bloqueia os sincronizados', async () => {
  const pendente = await plano(vendedores[0], false)
  const ids = [await plano(vendedores[1]), await plano(vendedores[2])]
  const respostas = await Promise.all([reivindicar(executores[0]), reivindicar(executores[1])])
  expect(respostas.map(r => r.pedido?.id).sort()).toEqual(ids.sort())
  expect(await reivindicar(executores[2])).toMatchObject({ pedido: null, sincronizar: pendente })
})

test('banco vincula execucao ao vendedor e limita execucoes abertas por vendedor e executor', async () => {
  const ids = [await plano(vendedores[0]), await plano(vendedores[1])]
  const a = (await reivindicar(executores[0])).pedido!
  const criar = (vendedor: string, executor: string) => banco.sql('INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,vendedor_id) VALUES ($1,$2,$3,$4)', [executor, gestor, ids[1], vendedor])
  await expect(criar(vendedores[3], randomUUID())).rejects.toMatchObject({ code: '23503' })
  await expect(criar(vendedores[1], executores[0])).rejects.toMatchObject({ code: '23505' })
  const [{ id: outroPedido }] = await banco.sql<{ id: string }>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES ($1,$2::date+1,'Brinquedos','','São Paulo','SP') RETURNING id", [a.vendedor_id, dia])
  await expect(banco.sql('INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,vendedor_id) VALUES ($1,$2,$3,$4)', [randomUUID(), gestor, outroPedido, a.vendedor_id])).rejects.toMatchObject({ code: '23505' })
  await expect(chamar(gestor, 'INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,vendedor_id) VALUES ($1,$2,$3,$4)', [randomUUID(), gestor, ids[1], vendedores[1]])).rejects.toMatchObject({ code: '42501' })
})

test('pendencia V1 roda sozinha e nao assume execucao V2', async () => {
  const antigo = await plano(vendedores[0])
  await banco.sql("UPDATE google_planejamento SET estado='coletando',iniciado_em=now(),snapshot=jsonb_build_object('nicho',nicho,'bairro',bairro,'cidade',cidade,'uf',uf) WHERE id=$1", [antigo])
  await plano(vendedores[1])
  const legado = await reivindicar(executores[0])
  expect(legado.pedido?.id).toBe(antigo)
  expect(await reivindicar(executores[1])).toMatchObject({ pedido: null, ocupado: true })
  expect((await reivindicar(executores[0])).pedido?.id).toBe(antigo)
})

test('entregas sobrepostas disputam distribuicao global sem duplicar destinatario', async () => {
  await plano(vendedores[0])
  await plano(vendedores[1])
  const pedidos = await Promise.all([reivindicar(executores[0]), reivindicar(executores[1])])
  expect(pedidos.every(p => p.pedido)).toBe(true)
  const entregas: (() => Promise<unknown>)[] = []
  for (let i = 0; i < pedidos.length; i++) {
    const p = pedidos[i].pedido!
    const candidatas = [{ google_place_id: 'mesma-empresa', cnpj: '11222333000181', nome_fantasia: 'Loja comum', telefone: '1133334444', email: 'comum@example.org' }, { google_place_id: 'alias-' + i, nome_fantasia: 'Mesmo contato', telefone: '1133334444', email: 'comum@example.org' }]
    const lote_id = randomUUID()
    await chamar(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3)', [p.id, executores[i], JSON.stringify({ lote_id, candidatas })])
    const recibo = { versao: 2, pedido_id: p.id, execucao_id: p.execucao_id, lote_id, revisao: p.revisao, snapshot_sha256: p.snapshot_sha256, origem_sha256: 'a'.repeat(64), resultado_sha256: 'b'.repeat(64), arquivo_original_id: 'original-' + i, arquivo_resultado_id: 'resultado-' + i, verificacoes_requeridas: [], evidencias: [] }
    entregas.push(() => chamar(gestor, 'SELECT google_agente_entregar($1,$2,$3,$4)', [p.id, JSON.stringify(candidatas), JSON.stringify(recibo), executores[i]]))
  }
  const trava = new Client({ connectionString: banco.urlAdmin })
  await trava.connect()
  await trava.query('BEGIN')
  await trava.query('SELECT pg_advisory_xact_lock(27,1)')
  const promessas = entregas.map(entregar => entregar())
  try {
    const limite = Date.now() + 5000
    let esperando = 0
    while (Date.now() < limite && esperando < 2) {
      const [{ n }] = await banco.sql<{ n: number }>("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())")
      esperando = n
      if (esperando < 2) await aguardar(10)
    }
    expect(esperando).toBe(2)
  } finally { await trava.query('ROLLBACK'); await trava.end() }
  await Promise.all(promessas)
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_exclusividade')).toEqual([{ n: 1 }])
  expect(await banco.sql("SELECT count(DISTINCT p.vendedor_id)::int AS n FROM google_resultado r JOIN google_planejamento p ON p.id=r.planejamento_id WHERE r.situacao='entregue'")).toEqual([{ n: 1 }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{ n: 1 }])
})
test('progresso e somente leitura e nao reivindica outro vendedor depois de concluir',async()=>{
  const id=await plano(vendedores[0])
  await plano(vendedores[1])
  const p=(await reivindicar(executores[0])).pedido!
  const {repositorioGoogle}=await import('@/src/features/google/repositorio')
  const consultar=()=>repositorioGoogle(gestor).consultar(id,executores[0])
  expect(await consultar()).toMatchObject({pedido_id:id,execucao_id:p.execucao_id,executor_id:executores[0],vendedor_id:p.vendedor_id,revisao:p.revisao,snapshot_sha256:p.snapshot_sha256,analisadas:0,entregues:0,lotes:0,vistas:[]})
  const lote_id=randomUUID()
  await chamar(gestor,'SELECT google_agente_reservar_lote($1,$2,$3)',[id,executores[0],JSON.stringify({lote_id,candidatas:[{google_place_id:'progresso-place',cnpj:'11222333000181',nome_fantasia:'Fixture'}]})])
  expect(await consultar()).toMatchObject({analisadas:1,lotes:1,vistas:['cnpj:11222333000181','progresso-place'],lote_pendente:{id:lote_id}})
  await banco.sql('UPDATE google_execucao SET concluido_em=now() WHERE pedido_id=$1',[id])
  expect((await consultar())?.concluido_em).not.toBeNull()
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_execucao')).toEqual([{n:1}])
  expect(await repositorioGoogle(outroGestor).consultar(id,executores[0])).toBeNull()
  expect(await repositorioGoogle(gestor).consultar(id,executores[1])).toBeNull()
  expect(await repositorioGoogle(vendedores[0]).consultar(id,executores[0])).toBeNull()
})