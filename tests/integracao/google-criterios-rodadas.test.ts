import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string
let outro: string
let gestor: string
let dias: string[]
const executor = randomUUID()
const chamar = (quem: string, sql: string, params: unknown[] = []) => banco.comoUsuario(quem, e => e(sql, params)).then(r => r.linhas)
const entrada = (dia: string, campos: Record<string, unknown> = {}) => ({ dia, nicho: 'Brinquedos', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', criterios: {}, ...campos })
const salvar = (planos = [entrada(dias[0])], quem = vendedor) => chamar(quem, 'SELECT google_planejamento_salvar_semana($1) AS r', [JSON.stringify(planos)])
async function iniciar() {
  await salvar()
  const [{ id }] = await banco.sql<{ id: string }>('SELECT id FROM google_planejamento WHERE vendedor_id=$1', [vendedor])
  await chamar(gestor, "SELECT google_planilha_preparar($1,'fixture:123')", [id])
  await chamar(gestor, 'SELECT google_planilha_confirmar($1,versao,NULL) FROM google_sincronizacao WHERE pedido_id=$1', [id])
  const sexta = new Date(dias[0] + 'T12:00:00Z')
  sexta.setUTCDate(sexta.getUTCDate() - 3)
  const agora = sexta.toISOString().slice(0, 10) + 'T17:00:00-03:00'
  const [{ r }] = await banco.sql<{ r: { pedido: { id: string; snapshot: unknown; execucao_id: string; revisao: number }; ocupado?: boolean } }>("SELECT google_coordenar_em($2,$3::timestamptz) AS r FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) x", [gestor, executor, agora])
  return { id, r, agora }
}
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Criterios Vendedor')
  outro = await criarUsuario(banco, 'vendedor', 'Criterios Outro')
  gestor = await criarUsuario(banco, 'gestor', 'Criterios Gestor')
  dias = (await banco.sql<{ dia: string }>("SELECT to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '14 days'+i*interval '1 day','YYYY-MM-DD') AS dia FROM generate_series(0,4) i")).map(r => r.dia)
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM google_execucao')
  await banco.sql('DELETE FROM google_planilha_tentativa')
  await banco.sql('DELETE FROM google_sincronizacao')
  await banco.sql('DELETE FROM google_planejamento')
  await banco.sql('DELETE FROM google_rotina')
})
test('novo vendedor tem agente, nenhum planejamento e nenhuma empresa herdada', async () => {
  expect(await chamar(vendedor, 'SELECT vendedor_id FROM google_agente')).toEqual([{ vendedor_id: vendedor }])
  expect(await chamar(vendedor, 'SELECT id FROM google_planejamento')).toEqual([])
})
test('salva semana com dias não definidos e critérios normalizados', async () => {
  await salvar(dias.map((dia, i) => entrada(dia, i ? { nicho: '', bairro: '', cidade: '', uf: '' } : { criterios: { site: ['com', 'sem'], nota: 0 } })))
  const rows = await chamar(vendedor, 'SELECT nicho,criterios FROM google_planejamento ORDER BY dia')
  expect(rows).toHaveLength(5)
  expect(rows[0]).toMatchObject({ nicho: 'Brinquedos', criterios: { site: [], nota: 0 } })
  expect(rows[1]).toMatchObject({ nicho: '' })
})
test('dia parcial, passado e critérios desconhecidos não deixam gravação parcial', async () => {
  for (const invalido of [entrada(dias[1], { cidade: '' }), entrada('2026-01-05'), entrada(dias[1], { criterios: { nota: 6 } }), entrada(dias[1], { criterios: { desconhecido: true } })]) {
    await expect(salvar([entrada(dias[0]), invalido])).rejects.toMatchObject({ code: '22023' })
    expect(await chamar(vendedor, 'SELECT id FROM google_planejamento')).toEqual([])
  }
})
test('sexta às 17h reserva segunda uma vez e edição futura preserva execução', async () => {
  const { id, r, agora } = await iniciar()
  expect(r.pedido).toMatchObject({ id, dia: dias[0], snapshot: { nicho: 'Brinquedos', criterios: { telefone: [] } } })
  await salvar([entrada(dias[0], { nicho: 'Pet shops', criterios: { telefone: ['fixo'] } })])
  const [atual] = await banco.sql<{ revisao: number; snapshot: unknown }>('SELECT revisao,snapshot FROM google_planejamento WHERE id=$1', [id])
  expect(atual.revisao).toBe(2)
  expect(atual.snapshot).toEqual(r.pedido.snapshot)
  const [{ r: retomada }] = await banco.sql<{ r: unknown }>("SELECT google_coordenar_em($2,$3::timestamptz) AS r FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) x", [gestor, executor, agora])
  expect(retomada).toMatchObject({ pedido: { id, snapshot: r.pedido.snapshot, revisao: 1 } })
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_execucao')).toEqual([{ n: 1 }])
})
test('cópia seletiva histórica é privada e atômica', async () => {
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios) VALUES ($1,$2::date-14,'Tecidos','Brás','São Paulo','SP','{\"telefone\":[\"fixo\"]}') RETURNING id", [vendedor, dias[0]])
  await salvar([entrada(dias[1])])
  await chamar(vendedor, 'SELECT google_planejamento_copiar($1,1,$2,$3)', [id, [dias[1]], ['criterios']])
  expect(await chamar(vendedor, 'SELECT nicho,bairro,criterios FROM google_planejamento WHERE dia=$1', [dias[1]])).toMatchObject([{ nicho: 'Brinquedos', bairro: 'Centro', criterios: { telefone: ['fixo'] } }])
  await expect(chamar(outro, 'SELECT google_planejamento_copiar($1,1,$2,$3)', [id, [dias[2]], ['nicho']])).rejects.toMatchObject({ code: '42501' })
  await expect(chamar(vendedor, 'SELECT google_planejamento_copiar($1,2,$2,$3)', [id, [dias[2]], ['regiao']])).rejects.toMatchObject({ code: '55000' })
  await expect(chamar(vendedor, 'SELECT google_planejamento_copiar($1,1,$2,$3)', [id, [dias[2], '2026-01-05'], ['nicho']])).rejects.toMatchObject({ code: '22023' })
  expect(await chamar(vendedor, 'SELECT id FROM google_planejamento WHERE dia=$1', [dias[2]])).toEqual([])
})
test('reserva três lotes, retoma sem consumir novamente e bloqueia quarto', async () => {
  const { id } = await iniciar()
  for (let rodada = 0; rodada < 3; rodada++) {
    const lote = { lote_id: randomUUID(), candidatas: Array.from({ length: 50 }, (_, i) => ({ google_place_id: `place-${rodada}-${i}`, nome_fantasia: 'Loja' })) }
    const reserva = () => chamar(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3) AS r', [id, executor, JSON.stringify(lote)])
    expect(await reserva()).toMatchObject([{ r: { id: lote.lote_id, ordinal: rodada + 1 } }])
    await reserva()
    expect(await banco.sql('SELECT analisadas FROM google_execucao WHERE pedido_id=$1', [id])).toEqual([{ analisadas: (rodada + 1) * 50 }])
    await expect(chamar(gestor, 'SELECT google_agente_concluir($1,$2,$3)', [id, executor, 'sem_novidades'])).rejects.toMatchObject({ code: '55000' })
    await banco.sql('UPDATE google_lote SET concluido_em=now() WHERE id=$1', [lote.lote_id])
  }
  await expect(chamar(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3)', [id, executor, JSON.stringify({ lote_id: randomUUID(), candidatas: [{ google_place_id: 'quarto' }] })])).rejects.toMatchObject({ code: '55000' })
  await chamar(gestor, 'SELECT google_agente_concluir($1,$2,$3)', [id, executor, 'limite_lotes'])
  await chamar(gestor, 'SELECT google_agente_concluir($1,$2,$3)', [id, executor, 'limite_lotes'])
})
test('reservas concorrentes não abrem dois lotes pendentes e não aceitam executor alheio', async () => {
  const { id } = await iniciar()
  const reservar = (lote_id = randomUUID(), dono = executor) => chamar(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3)', [id, dono, JSON.stringify({ lote_id, candidatas: [{ google_place_id: lote_id }] })])
  const resultados = await Promise.allSettled([reservar(), reservar()])
  expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(await banco.sql('SELECT analisadas FROM google_execucao WHERE pedido_id=$1', [id])).toEqual([{ analisadas: 1 }])
  await expect(reservar(randomUUID(), randomUUID())).rejects.toMatchObject({ code: '55000' })
})
