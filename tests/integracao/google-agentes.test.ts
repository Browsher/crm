import { randomUUID } from 'node:crypto'
import { Client, type QueryResultRow } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { criteriosVazios } from '@/src/lib/google/criterios'

let banco: BancoDeTeste
let gestor: string
let gestor2: string
let vendedor: string
let outro: string
let dia: string
const executor = randomUUID()
const chamar = <T extends QueryResultRow = Record<string, unknown>>(usuario: string, sql: string, params: unknown[] = []) =>
  banco.comoUsuario(usuario, e => e<T>(sql, params)).then(r => r.linhas)
const plano = (usuario = vendedor) => chamar<{ id: string }>(usuario, "SELECT google_planejar($1,'Brinquedos','Centro','São Paulo','SP') AS id", [dia]).then(r => r[0].id)
type Espelho = { pedido: string; linha: number; versao: number; revisao: number; dados: { nicho: string } }
const preparar = (id: string, destino = 'planilha-fixture:123') => chamar<{ p: Espelho }>(gestor, 'SELECT google_planilha_preparar($1,$2) AS p', [id, destino]).then(r => r[0].p)
async function sincronizar(id: string) {
  const p = await preparar(id)
  await chamar(gestor, 'SELECT google_planilha_confirmar($1,$2,NULL)', [id, p.versao])
}
type Coleta = { pedido: { id: string; vendedor_id: string } | null; ocupado?: boolean; sincronizar?: string }
const proximo = (quem = executor, data = dia, autor = gestor) => banco.sql<{ r: Coleta }>(
  "SELECT google_coordenar_em($2,(($3::date-CASE WHEN extract(isodow FROM $3::date)=1 THEN 3 ELSE 1 END)::text||'T17:00:00-03:00')::timestamptz) AS r FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) identidade", [autor, quem, data]).then(r => r[0].r)

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'AgenteGestor')
  gestor2 = await criarUsuario(banco, 'gestor', 'AgenteGestorDois')
  vendedor = await criarUsuario(banco, 'vendedor', 'AgenteVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'AgenteOutro')
  // A sexta simulada precisa ocorrer depois da criação do plano, inclusive
  // quando esta suíte roda numa sexta real após as 17h.
  dia = (await banco.sql<{ dia: string }>("SELECT to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '14 days','YYYY-MM-DD') AS dia"))[0].dia
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM google_execucao')
  await banco.sql('DELETE FROM google_exclusividade')
  await banco.sql('DELETE FROM google_resultado')
  await banco.sql('DELETE FROM google_publicacao')
  await banco.sql('DELETE FROM google_planilha_tentativa')
  await banco.sql('DELETE FROM google_sincronizacao')
  await banco.sql('DELETE FROM google_planejamento')
  await banco.sql('DELETE FROM google_rotina')
  await banco.sql('UPDATE google_agente SET pausado=false')
  await banco.sql("UPDATE usuario SET ativo=true,senha_provisoria_pendente=false,papel='vendedor' WHERE id IN ($1,$2)", [vendedor, outro])
})

test('intenção de escrita fica guardada antes do Google e não aceita conteúdo divergente na mesma versão', async () => {
  const id = await plano()
  const p = await preparar(id)
  const celulas = [id,'1',vendedor,'AgenteVendedor',dia,'segunda-feira','Brinquedos','Centro','São Paulo','SP','planejado','2026-10-22T00:00:00.000Z',String(p.versao),JSON.stringify(criteriosVazios())]
  await chamar(gestor, 'SELECT google_planilha_intencao($1,$2,$3)', [id,p.versao,JSON.stringify(celulas)])
  await expect(chamar(gestor, 'SELECT google_planilha_intencao($1,$2,$3)', [id,p.versao,JSON.stringify([...celulas.slice(0,6),'Outra',...celulas.slice(7)])])).rejects.toMatchObject({code:'22023'})
  await chamar(vendedor, "SELECT google_planejar($1,'Pet shops','','São Paulo','SP')", [dia])
  expect(await preparar(id)).toMatchObject({ anteriores: [celulas] })
})

test('cada vendedor tem seu agente privado e os dois gestores compartilham a equipe', async () => {
  expect(await chamar(vendedor, 'SELECT vendedor_id FROM google_agente')).toEqual([{ vendedor_id: vendedor }])
  expect(await chamar(gestor, 'SELECT count(*)::int AS n FROM google_agente')).toEqual([{ n: 2 }])
  await chamar(gestor2, 'SELECT google_agente_definir($1,true)', [vendedor])
  expect(await chamar(vendedor, 'SELECT pausado FROM google_agente')).toEqual([{ pausado: true }])
  await expect(chamar(outro, 'SELECT google_agente_definir($1,false)', [vendedor])).rejects.toMatchObject({ code: '42501' })
})
test('salvar registra revisão e pendência atômicas; outro vendedor não lê os critérios', async () => {
  const id = await plano()
  const p = await preparar(id)
  expect(p).toMatchObject({ pedido: id, revisao: 1, dados: { nicho: 'Brinquedos' } })
  expect(p.linha).toBeGreaterThan(1)
  expect(await chamar(outro, 'SELECT pedido_id FROM google_sincronizacao')).toEqual([])
  await expect(chamar(vendedor, 'SELECT google_planilha_confirmar($1,$2,NULL)', [id, p.versao])).rejects.toMatchObject({ code: '42501' })
})
test('retomada usa a mesma linha e mantém destino vinculado mesmo com erro', async () => {
  const id = await plano()
  const p = await preparar(id)
  await chamar(gestor, 'SELECT google_planilha_confirmar($1,$2,$3)', [id, p.versao, 'Retorno não confirmado'])
  expect(await preparar(id)).toMatchObject({ linha: p.linha, versao: p.versao })
  await expect(preparar(id, 'outra-planilha:123')).rejects.toMatchObject({ code: '55000' })
})
test('confirmação de revisão antiga não aprova edição mais recente', async () => {
  const id = await plano()
  const antigo = await preparar(id)
  await chamar(vendedor, "SELECT google_planejar($1,'Pet shops','','São Paulo','SP')", [dia])
  expect(await chamar(gestor, 'SELECT google_planilha_confirmar($1,$2,NULL) AS ok', [id, antigo.versao])).toEqual([{ ok: false }])
  expect(await preparar(id)).toMatchObject({ revisao: 2, dados: { nicho: 'Pet shops' } })
})
test('o agente só inicia com a revisão correta confirmada', async () => {
  const id = await plano()
  expect(await proximo()).toMatchObject({ pedido: null, sincronizar: id })
  await sincronizar(id)
  expect(await proximo()).toMatchObject({ pedido: { id, vendedor_id: vendedor } })
})
test('dois executores atendem vendedores diferentes e cada dono retoma', async () => {
  const a = await plano()
  const b = await plano(outro)
  await sincronizar(a)
  await sincronizar(b)
  expect(await proximo()).toMatchObject({ pedido: { id: a } })
  const segundoExecutor = randomUUID()
  expect(await proximo(segundoExecutor)).toMatchObject({ pedido: { id: b } })
  expect(await proximo()).toMatchObject({ pedido: { id: a } })
  expect(await proximo(segundoExecutor)).toMatchObject({ pedido: { id: b } })
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_execucao WHERE concluido_em IS NULL')).toEqual([{ n: 2 }])
})
test('pausa bloqueia novas buscas, mas não invalida a etapa iniciada', async () => {
  const id = await plano()
  await sincronizar(id)
  await chamar(gestor, 'SELECT google_agente_definir($1,true)', [vendedor])
  expect((await proximo()).pedido).toBeNull()
  await chamar(gestor, 'SELECT google_agente_definir($1,false)', [vendedor])
  expect((await proximo()).pedido?.id).toBe(id)
  await chamar(gestor, 'SELECT google_agente_definir($1,true)', [vendedor])
  await chamar(gestor, "SELECT google_agente_etapa($1,'validando',NULL,$2)", [id, executor])
  await expect(chamar(gestor, "SELECT google_agente_etapa($1,'validando',NULL,$2)", [id, randomUUID()])).rejects.toMatchObject({ code: '55000' })
})
test('pedidos vencidos sem início ficam no histórico e não acumulam novas buscas', async () => {
  const id = await plano()
  await sincronizar(id)
  const amanha = (await banco.sql<{ dia: string }>("SELECT to_char($1::date+1,'YYYY-MM-DD') AS dia", [dia]))[0].dia
  expect((await proximo(executor, amanha)).pedido).toBeNull()
  expect(await chamar(vendedor, 'SELECT estado FROM google_planejamento WHERE id=$1', [id])).toEqual([{ estado: 'cancelado' }])
})
test('executor de outro gestor não assume a execução em andamento e contrato antigo falha fechado', async () => {
  const id = await plano()
  await sincronizar(id)
  await proximo()
  expect(await proximo(executor, dia, gestor2)).toMatchObject({ ocupado: true })
  await expect(chamar(gestor, "SELECT google_agente_etapa($1,'validando',NULL)", [id])).rejects.toMatchObject({ code: '55000' })
})

test.each(['vendedor','gestor'] as const)('início serializa desativação do %s enquanto a sincronização bloqueia a gravação',async alvo=>{
  const id=await plano()
  await sincronizar(id)
  await banco.sql('INSERT INTO google_rotina(dia,iniciado_em) VALUES ($1,now())',[dia])
  await banco.sql("UPDATE google_planejamento SET estado='aguardando' WHERE id=$1",[id])
  const bloqueio=new Client({connectionString:banco.urlAdmin})
  const alteracao=new Client({connectionString:banco.urlAdmin})
  await bloqueio.connect(); await alteracao.connect()
  const {rows:[{pid}]}=await alteracao.query<{pid:number}>('SELECT pg_backend_pid() AS pid')
  let terminou=false
  let coleta:ReturnType<typeof proximo>|undefined
  let desativacao:Promise<unknown>|undefined
  try {
    await bloqueio.query('BEGIN')
    await bloqueio.query('SELECT pedido_id FROM google_sincronizacao WHERE pedido_id=$1 FOR UPDATE',[id])
    coleta=proximo()
    await expect.poll(async()=>(await banco.sql<{n:number}>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'SELECT google_coordenar_em(%' AND wait_event_type='Lock'"))[0].n).toBe(1)
    desativacao=alteracao.query('UPDATE usuario SET ativo=false WHERE id=$1',[alvo==='vendedor'?vendedor:gestor]).then(()=>{terminou=true})
    await expect.poll(async()=>terminou||(await banco.sql<{n:number}>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'",[pid]))[0].n===1).toBe(true)
    expect(terminou).toBe(false)
  } finally {
    await bloqueio.query('ROLLBACK')
    await Promise.allSettled([coleta,desativacao])
    await bloqueio.end(); await alteracao.end()
    await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1',[gestor])
  }
})

test('vendedor promovido enquanto espera pelo planejamento não salva depois como gestor',async()=>{
  const bloqueio=new Client({connectionString:banco.urlAdmin})
  await bloqueio.connect()
  let salvamento:Promise<unknown>|undefined
  try {
    await bloqueio.query('BEGIN')
    await bloqueio.query('SELECT pg_advisory_xact_lock(40,1)')
    salvamento=plano().catch(erro=>erro)
    await expect.poll(async()=>(await banco.sql<{n:number}>("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND query LIKE 'SELECT google_planejar(%' AND wait_event_type='Lock'"))[0].n).toBe(1)
    await banco.sql("UPDATE usuario SET papel='gestor' WHERE id=$1",[vendedor])
  } finally {
    await bloqueio.query('ROLLBACK')
    await bloqueio.end()
  }
  expect(await salvamento).toMatchObject({code:'42501'})
  expect(await banco.sql('SELECT id FROM google_planejamento')).toEqual([])
})
