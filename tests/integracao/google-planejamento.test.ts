import { randomUUID } from 'node:crypto'
import type { QueryResultRow } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
let dia: string
const empresa = { cnpj: '11222333000181', google_place_id: 'ChIJ-fixture-google', nome_fantasia: 'Loja de brinquedos',
  razao_social: 'Loja teste LTDA', telefone: '11988887777', email: 'loja@exemplo.test', endereco: 'Endereço real recebido', validado: true }
const recibo = (id: string) => ({ pedido_id: id, origem_sha256: 'a'.repeat(64), final_sha256: 'b'.repeat(64),
  arquivo_original_id: 'drive-fixture-original', arquivo_final_id: 'drive-fixture-final', validacao_conferida: true })
const chamar = <T extends QueryResultRow = { resultado: string }>(usuario: string, sql: string, params: unknown[] = []) =>
  banco.comoUsuario(usuario, e => e<T>(sql, params)).then(r => r.linhas)
const planejar = (usuario = vendedor, data = dia, nicho = 'Loja de brinquedos') =>
  chamar<{ id: string }>(usuario, 'SELECT google_planejar($1,$2,$3,$4,$5) AS id', [data, nicho, 'Brás', 'São Paulo', 'SP']).then(r => r[0].id)
async function iniciado(usuario = vendedor) {
  const id = await planejar(usuario)
  await banco.sql("UPDATE google_planejamento SET estado='coletando',iniciado_em=now(),snapshot=jsonb_build_object('nicho',nicho,'bairro',bairro,'cidade',cidade,'uf',uf) WHERE id=$1", [id])
  return id
}
const entregar = (id: string, empresas: unknown[] = [empresa], comprovante = recibo(id), usuario = gestor) =>
  chamar(usuario, 'SELECT google_agente_entregar($1,$2,$3) AS resultado', [id, JSON.stringify(empresas), JSON.stringify(comprovante)])

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'GoogleGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'GoogleVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'GoogleOutro')
  const [r] = await banco.sql<{ dia: string }>("SELECT to_char(date_trunc('week',now() AT TIME ZONE 'America/Sao_Paulo')+interval '7 days','YYYY-MM-DD') AS dia")
  dia = r.dia
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM google_exclusividade')
  await banco.sql('DELETE FROM google_resultado')
  await banco.sql('DELETE FROM google_publicacao')
  await banco.sql('DELETE FROM google_planejamento')
  await banco.sql('DELETE FROM google_rotina')
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false WHERE id IN ($1,$2)', [vendedor, outro])
})

test('plano é privado, gestor acompanha todos e vendedor não escolhe o destinatário', async () => {
  const id = await planejar()
  expect(await chamar(outro, 'SELECT id FROM google_planejamento')).toEqual([])
  expect(await chamar(gestor, 'SELECT id FROM google_planejamento')).toEqual([{ id }])
  await expect(chamar(outro, 'UPDATE google_planejamento SET vendedor_id=$1 WHERE id=$2', [outro, id])).rejects.toMatchObject({ code: '42501' })
  await expect(planejar(gestor)).rejects.toMatchObject({ code: '42501' })
})
test('editar preserva identidade e a semana seguinte não herda critérios', async () => {
  const id = await planejar()
  expect(await planejar(vendedor, dia, 'Pet shop')).toBe(id)
  expect(await chamar(vendedor, 'SELECT nicho FROM google_planejamento')).toEqual([{ nicho: 'Pet shop' }])
  expect(await chamar(vendedor, "SELECT id FROM google_planejamento WHERE dia=$1::date+7", [dia])).toEqual([])
})
test('banco rejeita fim de semana, UF inválida, controles e dia passado', async () => {
  await expect(planejar(vendedor, '2020-01-06')).rejects.toMatchObject({ code: '22023' })
  const [r] = await banco.sql<{ sabado: string }>("SELECT to_char($1::date+5,'YYYY-MM-DD') AS sabado", [dia])
  await expect(planejar(vendedor, r.sabado)).rejects.toMatchObject({ code: '22023' })
  await expect(chamar(vendedor, 'SELECT google_planejar($1,$2,$3,$4,$5)', [dia, 'loja\u0001', '', 'Cidade', 'XX'])).rejects.toMatchObject({ code: '22023' })
})
test('snapshot impede editar o pedido já iniciado e senha provisória impede planejar', async () => {
  await iniciado()
  await expect(planejar(vendedor, dia, 'Pet shop')).rejects.toMatchObject({ code: '55000' })
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [outro])
  await expect(planejar(outro)).rejects.toMatchObject({ code: '42501' })
})
test('agente só é acessível ao gestor e não publica lote desconhecido ou recibo de outro pedido', async () => {
  const id = await iniciado()
  await expect(entregar(id, [empresa], recibo(id), vendedor)).rejects.toMatchObject({ code: '42501' })
  await expect(entregar(randomUUID())).rejects.toMatchObject({ code: '22023' })
  await expect(entregar(id, [empresa], recibo(randomUUID()))).rejects.toMatchObject({ code: '22023' })
  await expect(entregar(id, [empresa], { ...recibo(id), validacao_conferida: false })).rejects.toMatchObject({ code: '22023' })
})
test('primeira entrega dá exclusividade sem criar carteira nem reserva', async () => {
  const id = await iniciado()
  expect(await entregar(id)).toEqual([{ resultado: 'ok' }])
  expect(await banco.sql('SELECT vendedor_id FROM google_exclusividade')).toEqual([{ vendedor_id: vendedor }])
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual([])
  expect(await chamar(vendedor, 'SELECT situacao,dados FROM google_resultado')).toMatchObject([{ situacao: 'entregue', dados: empresa }])
  expect(await chamar(outro, 'SELECT * FROM google_resultado')).toEqual([])
})
test('mesma empresa em duas coletas conserva ambas as ocorrências sem expor telefone ao segundo', async () => {
  const primeiro = await iniciado()
  const segundo = await iniciado(outro)
  await entregar(primeiro)
  await entregar(segundo)
  expect(await chamar(outro, 'SELECT * FROM google_resultado')).toEqual([])
  expect(await chamar(outro, 'SELECT * FROM google_publicacao')).toEqual([])
  expect(await chamar(gestor, 'SELECT situacao FROM google_resultado ORDER BY criado_em,id')).toEqual([{ situacao: 'entregue' }, { situacao: 'indisponivel' }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{ n: 1 }])
})
test('publicações concorrentes da mesma empresa criam somente um destinatário', async () => {
  const a = await iniciado()
  const b = await iniciado(outro)
  await Promise.all([entregar(a), entregar(b)])
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_exclusividade')).toEqual([{ n: 1 }])
  expect(await banco.sql("SELECT count(*)::int AS n FROM google_resultado WHERE situacao='entregue'")).toEqual([{ n: 1 }])
})
test('repetir retorno reutiliza entrega e retorno divergente é recusado', async () => {
  const id = await iniciado()
  await entregar(id)
  expect(await entregar(id)).toEqual([{ resultado: 'repetida' }])
  await expect(entregar(id, [{ ...empresa, nome_fantasia: 'Outro nome' }])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT count(*)::int AS n FROM google_resultado')).toEqual([{ n: 1 }])
})
test('sem telefone, sem validação e empresa fechada ficam na auditoria, sem distribuição', async () => {
  const id = await iniciado()
  await entregar(id, [{ ...empresa, telefone: '' }, { ...empresa, google_place_id: 'outra', cnpj: null, validado: false },
    { ...empresa, google_place_id: 'fechada', cnpj: null, fechada: true }])
  expect(await banco.sql('SELECT * FROM google_exclusividade')).toEqual([])
  expect(await chamar(gestor, 'SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'pendente' }, { situacao: 'pendente' }, { situacao: 'pendente' }])
})
test('desativação após coleta preserva resultados para gestor sem entregar', async () => {
  const id = await iniciado()
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  expect(await entregar(id)).toEqual([{ resultado: 'vendedor_inativo' }])
  expect(await banco.sql('SELECT * FROM google_exclusividade')).toEqual([])
  expect(await chamar(gestor, 'SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'pendente' }])
})
test('cadastro manual e posse anterior são conservados', async () => {
  const [{ id: empresaId }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ($1,'Nome manual','1133332222') RETURNING id", [empresa.cnpj])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [empresaId, outro])
  const id = await iniciado()
  await entregar(id)
  expect(await banco.sql('SELECT razao_social,telefone FROM empresa')).toEqual([{ razao_social: 'Nome manual', telefone: '1133332222' }])
  expect(await banco.sql('SELECT * FROM google_exclusividade')).toEqual([])
})
test('CNPJ e Place ID apontando para cadastros distintos ficam em conflito', async () => {
  await banco.sql("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ($1,'CNPJ','1133332222')", [empresa.cnpj])
  const [{ id: e }] = await banco.sql<{ id: string }>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Google','11999998888') RETURNING id")
  await banco.sql('INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES ($1,$2)', [empresa.google_place_id, e])
  const id = await iniciado()
  await entregar(id)
  expect(await chamar(gestor, 'SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'conflito' }])
  expect(await banco.sql('SELECT * FROM google_exclusividade')).toEqual([])
})
test('exclusividade impede reserva por alvo direto e fonte compartilhada', async () => {
  const id = await iniciado()
  await entregar(id)
  const [{ empresa_id: e }] = await banco.sql<{ empresa_id: string }>('SELECT empresa_id FROM google_exclusividade')
  expect(await chamar(outro, "SELECT resultado FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,NULL)", [e])).toEqual([{ resultado: 'indisponivel' }])
  expect(await chamar(vendedor, "SELECT resultado FROM fila_reservar($1,'',NULL,NULL,NULL,NULL,NULL)", [e])).toEqual([{ resultado: 'ok' }])
})

test('rotina congela todos os pedidos do dia às 9h e retoma o mesmo lote antes de avançar', async () => {
  const a = await planejar()
  const b = await planejar(outro)
  const proximo = (hora: string) => banco.sql<{ pedido: { id: string } | null }>(
    "SELECT google_agente_proximo_em($2::timestamptz) AS pedido FROM (SELECT set_config('app.usuario_id',$1,false) OFFSET 0) identidade", [gestor, `${dia}T${hora}-03:00`])
  expect(await proximo('08:59:00')).toEqual([{ pedido: null }])
  expect((await proximo('09:00:00'))[0].pedido?.id).toBe(a)
  expect((await proximo('09:01:00'))[0].pedido?.id).toBe(a)
  expect(await chamar(outro, 'SELECT estado,snapshot FROM google_planejamento WHERE id=$1', [b])).toMatchObject([{ estado: 'aguardando', snapshot: { nicho: 'Loja de brinquedos' } }])
  await expect(planejar(outro, dia, 'Outra pesquisa')).rejects.toMatchObject({ code: '55000' })
  await entregar(a)
  expect((await proximo('09:05:00'))[0].pedido?.id).toBe(b)
  await entregar(b, [])
  expect(await proximo('09:06:00')).toEqual([{ pedido: null }])
})
