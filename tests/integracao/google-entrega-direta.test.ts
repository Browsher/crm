import { randomUUID } from 'node:crypto'
import { beforeAll, beforeEach, afterAll, test, expect } from 'vitest'
import { criarBancoDeTeste, criarUsuario, SQL_RESERVAR_PROXIMA, type BancoDeTeste } from './ajuda'
import { criteriosVazios, verificacoesNecessarias, type CriteriosGoogle } from '@/src/lib/google/criterios'
import type { EvidenciaGoogle } from '@/src/lib/google/entrega'
let banco: BancoDeTeste
let gestor: string
let vendedor: string
let dia: string
const executor = randomUUID()
const chamar = (quem: string, sql: string, p: unknown[] = []) => banco.comoUsuario(quem, e => e(sql, p)).then(r => r.linhas)
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Entrega Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Entrega Vendedor')
  dia = (await banco.sql<{ dia: string }>("SELECT to_char(date_trunc('week',now())+interval '14 days','YYYY-MM-DD') AS dia"))[0].dia
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
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [vendedor])
})
async function preparar(c: CriteriosGoogle = criteriosVazios()) {
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios,snapshot,estado) VALUES ($1,$2,'Loja','','São Paulo','SP',$3,jsonb_build_object('nicho','Loja','bairro','','cidade','São Paulo','uf','SP','criterios',$3::jsonb,'revisao',1),'coletando') RETURNING id", [vendedor, dia, JSON.stringify(c)])
  const [{ eid, hash }] = await banco.sql<{ eid: string; hash: string }>("INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,revisao,snapshot) SELECT $1,$2,id,1,snapshot FROM google_planejamento WHERE id=$3 RETURNING id AS eid,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') AS hash", [executor, gestor, id])
  async function lote(empresas: Record<string, unknown>[], evidencias: EvidenciaGoogle[] = []) {
    const lote_id = randomUUID()
    await chamar(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3)', [id, executor, JSON.stringify({ lote_id, candidatas: empresas })])
    const recibo = { versao: 2, pedido_id: id, execucao_id: eid, lote_id, revisao: 1, snapshot_sha256: hash, origem_sha256: 'a'.repeat(64), resultado_sha256: 'b'.repeat(64), arquivo_original_id: 'raw', arquivo_resultado_id: 'resultado', verificacoes_requeridas: verificacoesNecessarias(c), evidencias }
    const entregar = (r: Record<string, unknown> = recibo, linhas = empresas) => chamar(gestor, 'SELECT google_agente_entregar($1,$2,$3,$4) AS r', [id, JSON.stringify(linhas), JSON.stringify(r), executor])
    return { recibo, entregar, lote_id }
  }
  return { id, eid, lote }
}
test('sem critérios entrega até sem telefone, site e endereço e sem excluir fechada', async () => {
  const p = await preparar()
  const l = await p.lote([{ google_place_id: 'direta', nome_fantasia: 'Loja sem contato', fechada: true }])
  expect(await l.entregar()).toEqual([{ r: 'ok' }])
  expect(await l.entregar()).toEqual([{ r: 'repetida' }])
  expect(await chamar(vendedor, SQL_RESERVAR_PROXIMA)).toHaveLength(1)
  expect(await chamar(vendedor, 'SELECT nome_fantasia,telefone FROM empresa')).toEqual([{ nome_fantasia: 'Loja sem contato', telefone: null }])
  expect(await banco.sql('SELECT analisadas,entregues FROM google_execucao WHERE id=$1', [p.eid])).toEqual([{ analisadas: 1, entregues: 1 }])
})
test('servidor recusa revisão, lista de verificações ou candidatas divergentes', async () => {
  const p = await preparar({ ...criteriosVazios(), telefone: ['whatsapp'] })
  const l = await p.lote([{ google_place_id: 'whatsapp', nome_fantasia: 'Loja', telefone: '11988887777' }])
  await expect(l.entregar({ ...l.recibo, verificacoes_requeridas: [] })).rejects.toMatchObject({ code: '22023' })
  await expect(l.entregar({ ...l.recibo, revisao: 2 })).rejects.toMatchObject({ code: '22023' })
  await expect(l.entregar(l.recibo, [{ google_place_id: 'outra', nome_fantasia: 'Outra' }])).rejects.toMatchObject({ code: '22023' })
  await l.entregar()
  expect(await banco.sql('SELECT entregues FROM google_execucao WHERE id=$1', [p.eid])).toEqual([{ entregues: 0 }])
})
test('fixo pode aprovar sem WhatsApp e evidência tem que corresponder ao telefone', async () => {
  const p = await preparar({ ...criteriosVazios(), telefone: ['whatsapp', 'fixo'] })
  const ev: EvidenciaGoogle = { candidata: 'fixo', criterio: 'telefone', opcao: 'fixo', contato: '1133334444', estado: 'aprovado', motivo: 'Formato de fixo', fonte: 'coleta_google', horario: '2026-10-23T17:00:00-03:00' }
  const l = await p.lote([{ google_place_id: 'fixo', nome_fantasia: 'Loja', telefone: '1133334444' }], [ev])
  await expect(l.entregar({ ...l.recibo, evidencias: [{ ...ev, contato: '1122223333' }] })).rejects.toMatchObject({ code: '22023' })
  await l.entregar()
  expect(await banco.sql('SELECT entregues FROM google_execucao WHERE id=$1', [p.eid])).toEqual([{ entregues: 1 }])
})
test('orçamento acumulado para em 50 e repetição da resposta não entrega novamente', async () => {
  const p = await preparar()
  const a = await p.lote(Array.from({ length: 49 }, (_, i) => ({ google_place_id: `a-${i}`, nome_fantasia: `Loja ${i}` })))
  await a.entregar()
  const b = await p.lote([{ google_place_id: 'b-0', nome_fantasia: 'Última' }, { google_place_id: 'b-1', nome_fantasia: 'Excedente' }])
  await b.entregar()
  await b.entregar()
  expect(await banco.sql('SELECT analisadas,entregues FROM google_execucao WHERE id=$1', [p.eid])).toEqual([{ analisadas: 51, entregues: 50 }])
  expect(await banco.sql("SELECT count(*)::int AS n FROM google_resultado WHERE situacao='entregue'")).toEqual([{ n: 50 }])
})
test('vendedor inativo conserva resultado para o gestor e não recebe empresa', async () => {
  const p = await preparar()
  const l = await p.lote([{ google_place_id: 'inativo', nome_fantasia: 'Loja' }])
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  expect(await l.entregar()).toEqual([{ r: 'vendedor_inativo' }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_exclusividade')).toEqual([{ n: 0 }])
})
test('cadastro direto sem origem Google continua exigindo telefone no banco', async () => {
  await expect(chamar(gestor, "INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Manual sem contato',NULL)")).rejects.toMatchObject({ code: '23514' })
})
test('reaproveita CNPJ preservando campos manuais e não entrega telefone de outra empresa', async () => {
  await banco.sql("INSERT INTO empresa(cnpj,nome_fantasia,telefone,email) VALUES ('11222333000181','Cadastro manual','1133334444','manual@exemplo.test')")
  const p = await preparar()
  const l = await p.lote([{ google_place_id: 'cadastro', cnpj: '11222333000181', nome_fantasia: 'Nome da coleta', telefone: '1144445555' }, { google_place_id: 'repetida', nome_fantasia: 'Outra loja', telefone: '1133334444' }])
  await l.entregar()
  expect(await chamar(gestor, 'SELECT nome_fantasia,telefone,email FROM empresa')).toEqual([{ nome_fantasia: 'Cadastro manual', telefone: '1133334444', email: 'manual@exemplo.test' }])
  expect(await banco.sql('SELECT entregues FROM google_execucao WHERE id=$1', [p.eid])).toEqual([{ entregues: 1 }])
})
