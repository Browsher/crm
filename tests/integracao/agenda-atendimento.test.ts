import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerAgendaAtendimento } from '@/src/server/atendimento/consulta'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import { arquivarSemInteresse, registrarContatoDireto, retomarAtendimento } from '@/src/server/atendimento/operacoes'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'
import { lerDashboard } from '@/src/features/gestao/consulta'

let banco: BancoDeTeste
let vendedor: string
let empresa: string
beforeAll(async () => { banco = await criarBancoDeTeste(); vendedor = await criarUsuario(banco, 'vendedor', 'Agenda') })
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Agenda','11987654321') RETURNING id")
  empresa = e.id
  await vincularGrupoAtivo(banco, [empresa])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')", [empresa, vendedor])
})
async function comando() { return { empresaId: empresa, chave: randomUUID(), versao: (await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0].versao } }
async function data(dias: number) { return (await banco.sql<{ data: string }>("SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date+$1::int,'YYYY-MM-DD') AS data", [dias]))[0].data }
async function registrar(dias: number | null, tipo: 'nao_atendeu' | 'nao_liguei' | 'interessado' = 'nao_atendeu') {
  expect(await registrarContatoDireto(vendedor, await comando(), { tipo, nota: 'Atividade real', proximoPasso: dias === null ? null : 'Tentar novamente', proximoPassoData: dias === null ? null : await data(dias) })).toMatchObject({ ok: true })
}
async function agenda() { const r = await lerAgendaAtendimento(vendedor); expect(r.ok).toBe(true); if (!r.ok) throw new Error('Agenda recusada'); return r.linhas }

test.each(['nao_atendeu', 'nao_liguei'] as const)('%s devido entra em Meu dia sem negociação ou venda', async tipo => {
  await registrar(0, tipo)
  expect((await agenda()).map(e => e.id)).toContain(empresa)
  const carteira = await lerMinhasEmpresas(vendedor, true)
  expect(carteira.ok && carteira.carteira.map(e => e.id)).not.toContain(empresa)
  expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])).toEqual([])
})
test('futuro e ausência de data não inferem tarefa de hoje', async () => {
  await registrar(1)
  expect((await agenda()).map(e => e.id)).not.toContain(empresa)
  await registrar(null)
  expect((await agenda()).map(e => e.id)).not.toContain(empresa)
})
test('arquivo manual e retomada não ressuscitam tarefa histórica nem inventam contato', async () => {
  await registrar(-1)
  const antes = await lerHistorico(vendedor, empresa)
  expect(await arquivarSemInteresse(vendedor, await comando(), null)).toMatchObject({ ok: true })
  expect((await agenda()).map(e => e.id)).not.toContain(empresa)
  expect(await retomarAtendimento(vendedor, await comando())).toMatchObject({ ok: true })
  expect((await agenda()).map(e => e.id)).not.toContain(empresa)
  expect(await lerHistorico(vendedor, empresa)).toEqual(antes)
})
test('primeira venda mantém agenda e cliente arquivado conserva carteira e histórico', async () => {
  await registrar(0, 'interessado')
  const [n] = await banco.sql<{ id: string }>('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])
  expect((await banco.comoUsuario(vendedor, sql => sql("SELECT funil_venda_registrar($1,$2,(now() AT TIME ZONE 'America/Sao_Paulo')::date,100,NULL) AS r", [n.id, randomUUID()]))).linhas[0]).toEqual({ r: 'ok' })
  expect((await agenda()).map(e => e.id)).toContain(empresa)
  expect(await arquivarSemInteresse(vendedor, await comando(), null)).toMatchObject({ ok: true })
  const carteira = await lerMinhasEmpresas(vendedor, true)
  expect(carteira.ok && carteira.carteira.find(e => e.id === empresa)).toMatchObject({ situacao: 'sem_interesse', proximoPassoData: null, reservadoAte: null })
  const historico = await lerHistorico(vendedor, empresa)
  expect(historico.ok && historico.contatos.some(c => c.venda)).toBe(true)
})

test('mais de cem tarefas usam resumos autorizados em lotes e ordem estável por data, nome e id', async () => {
  const novas=await banco.sql<{id:string;razao_social:string}>(`INSERT INTO empresa(razao_social,telefone)
    SELECT 'Lote ' || lpad(((n+1)/2)::text,3,'0'),'11987654321' FROM generate_series(1,105) n RETURNING id,razao_social`)
  const ids=novas.map(e=>e.id)
  await vincularGrupoAtivo(banco,ids)
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) SELECT unnest($1::uuid[]),$2,'legado'",[ids,vendedor])
  await banco.sql(`WITH contatos AS (INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data)
    SELECT unnest($1::uuid[]),'nao_atendeu','Ligar',(now() AT TIME ZONE 'America/Sao_Paulo')::date RETURNING id,empresa_id)
    UPDATE empresa_vinculo v SET agenda_contato_id=c.id FROM contatos c WHERE c.empresa_id=v.empresa_id`,[ids])
  const linhas=(await agenda()).filter(e=>ids.includes(e.id))
  const esperadas=[...novas].sort((a,b)=>a.razao_social.localeCompare(b.razao_social)||a.id.localeCompare(b.id))
  expect(linhas.map(e=>e.id)).toEqual(esperadas.map(e=>e.id))
  expect(linhas.every(e=>e.empresa?.versao===e.versao)).toBe(true)
  expect(linhas).toHaveLength(105)
  const gestor=await criarUsuario(banco,'gestor','AgendaLotes')
  const painel=await lerDashboard(gestor)
  const resumo=painel?.vendedores.find(v=>v.id===vendedor)
  expect((resumo?.hoje??0)+(resumo?.atrasados??0)).toBe((await agenda()).length)
})
