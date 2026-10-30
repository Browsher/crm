import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { iniciarBusca } from '@/src/features/busca-empresas/servico'
import { garantirInclusao } from '@/src/features/busca-empresas/inclusao-automatica'
import type { EmpresaEncontrada, FiltrosBusca } from '@/src/features/busca-empresas/tipos'

let banco: BancoDeTeste
let gestor: string
let a: string
let b: string
const filtros: FiltrosBusca = { palavra: 'Lojas', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 3, offset: 0 }
const empresa: EmpresaEncontrada = { cnpj: '11222333000181', razao_social: 'Loja', nome_fantasia: null, telefone: '11988887777', telefones: ['11988887777'], email: null, cep: null, cnae_principal: null, situacao: null, porte: null, data_abertura: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }
const call = (u: string, sql: string, p: unknown[] = []) => banco.comoUsuario(u, e => e(sql, p)).then(r => r.linhas)

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'ExclusivaGestor')
  a = await criarUsuario(banco, 'vendedor', 'ExclusivaA')
  b = await criarUsuario(banco, 'vendedor', 'ExclusivaB')
  for (const id of [a, b]) await call(gestor, 'SELECT busca_empresa_limite_definir($1,1000,false)', [id])
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  for (const tabela of ['google_execucao', 'google_resultado', 'google_publicacao', 'google_exclusividade', 'google_planilha_tentativa', 'google_sincronizacao', 'google_planejamento', 'empresa_origem_google', 'google_grupo', 'busca_empresa', 'grupo_importacao_empresa', 'grupo_importacao', 'empresa_vinculo_pendencia', 'empresa_vinculo', 'venda', 'negociacao', 'empresa_dados_cadastrais', 'empresa_fila', 'empresa']) await banco.sql(`DELETE FROM ${tabela}`)
})

async function prepararBanco(u: string, casa = false, linhas = [empresa]) {
  const id = randomUUID()
  await call(u, `SELECT ${casa ? 'busca_empresa_reservar_casa' : 'busca_empresa_reservar'}($1,'Lojas',$2)`, [id, JSON.stringify(filtros)])
  await call(u, 'SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify(linhas)])
  return { id, entregar: () => call(u, 'SELECT * FROM busca_empresa_importar($1,NULL)', [id]) }
}
async function prepararGoogle(u: string, linhas: Record<string, unknown>[] = [{ ...empresa, google_place_id: 'exclusiva' }], legado = false) {
  const executor = randomUUID()
  const [{ id }] = await banco.sql<{ id: string }>(`INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf,criterios,snapshot,estado)
    VALUES($1,date_trunc('week',now())+interval '14 days','Lojas','','São Paulo','SP','{}','{"criterios":{},"nicho":"Lojas","bairro":"","cidade":"São Paulo","uf":"SP"}','coletando') RETURNING id`, [u])
  const [{ eid, hash }] = await banco.sql<{ eid: string; hash: string }>(`INSERT INTO google_execucao(executor_id,gestor_id,pedido_id,vendedor_id,revisao,snapshot,contrato)
    SELECT $1,$2,id,vendedor_id,1,snapshot,$4 FROM google_planejamento WHERE id=$3 RETURNING id eid,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') hash`, [executor, gestor, id, legado ? 1 : 2])
  const lote = randomUUID()
  if (!legado) await call(gestor, 'SELECT google_agente_reservar_lote($1,$2,$3)', [id, executor, JSON.stringify({ lote_id: lote, candidatas: linhas })])
  const recibo = legado
    ? { pedido_id: id, validacao_conferida: true, origem_sha256: 'a'.repeat(64), final_sha256: 'b'.repeat(64), arquivo_original_id: 'raw', arquivo_final_id: 'resultado' }
    : { versao: 2, pedido_id: id, execucao_id: eid, lote_id: lote, revisao: 1, snapshot_sha256: hash, origem_sha256: 'a'.repeat(64), resultado_sha256: 'b'.repeat(64), arquivo_original_id: 'raw', arquivo_resultado_id: 'resultado', verificacoes_requeridas: [], evidencias: [] }
  return { id, entregar: () => call(gestor, 'SELECT google_agente_entregar($1,$2,$3,$4) r', [id, JSON.stringify(linhas), JSON.stringify(recibo), executor]) }
}
async function conferirUnica(vencedor?: string) {
  const vinculos = await banco.sql<{ vendedor_id: string }>('SELECT vendedor_id FROM empresa_vinculo')
  expect(vinculos).toHaveLength(1)
  if (vencedor) expect(vinculos[0].vendedor_id).toBe(vencedor)
  const entregas = await banco.sql<{ vendedor_id: string }>(`SELECT p.vendedor_id FROM google_resultado r JOIN google_planejamento p ON p.id=r.planejamento_id WHERE r.situacao='entregue'
    UNION ALL SELECT b.usuario_id FROM busca_empresa b JOIN grupo_importacao_empresa ge ON ge.grupo_id=b.grupo_id`)
  expect(entregas).toHaveLength(1)
  expect(vinculos[0].vendedor_id).toBe(entregas[0].vendedor_id)
  expect(await banco.sql('SELECT id FROM empresa')).toHaveLength(1)
  expect(await banco.sql('SELECT vendedor_id FROM empresa_fila WHERE vendedor_id IS NOT NULL')).toEqual([])
  expect(await banco.sql('SELECT id FROM negociacao')).toEqual([])
}

test.each([false, true])('Google → Banco preserva uma entrega (Casa=%s)', async casa => {
  await (await prepararGoogle(a)).entregar()
  const busca = await prepararBanco(b, casa)
  expect((await busca.entregar())[0]).toMatchObject({ inseridas: 0, vinculadas: 0 })
  await conferirUnica(a)
})
test.each([false, true])('Banco → Google preserva uma entrega (Casa=%s)', async casa => {
  await (await prepararBanco(a, casa)).entregar()
  const google = await prepararGoogle(b)
  await google.entregar()
  expect(await banco.sql('SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'indisponivel' }])
  await conferirUnica(a)
})
test.each(['google-banco', 'banco-google', 'banco-banco', 'google-google', 'legado-banco', 'banco-legado'])('concorrência %s confirma só um vencedor e replay não entrega', async ordem => {
  const prepararFonte = (u: string, fonte: string) => fonte === 'banco' ? prepararBanco(u)
    : prepararGoogle(u, [{ ...empresa, google_place_id: 'exclusiva', validado: true }], fonte === 'legado')
  const [fonteA, fonteB] = ordem.split('-')
  const x = await prepararFonte(a, fonteA)
  const y = await prepararFonte(b, fonteB)
  await Promise.all([x.entregar(), y.entregar()])
  await conferirUnica()
  await Promise.all([x.entregar(), y.entregar()])
  await conferirUnica()
})
test('Place ID sem CNPJ continua uma identidade; nomes iguais com IDs distintos não são fundidos', async () => {
  const x = await prepararGoogle(a, [{ google_place_id: 'sem-cnpj', nome_fantasia: 'Mesmo nome' }])
  const y = await prepararGoogle(b, [{ google_place_id: 'sem-cnpj', nome_fantasia: 'Mesmo nome' }, { google_place_id: 'outra-identidade', nome_fantasia: 'Mesmo nome' }])
  await Promise.all([x.entregar(), y.entregar()])
  expect(await banco.sql('SELECT id FROM empresa')).toHaveLength(2)
  expect(await banco.sql('SELECT empresa_id FROM empresa_vinculo')).toHaveLength(2)
  expect(await banco.sql("SELECT id FROM google_resultado WHERE situacao='entregue'")).toHaveLength(2)
})
test('mesmo vendedor em outra fonte não recebe uma segunda entrega nem novo grupo', async () => {
  await (await prepararBanco(a)).entregar()
  await (await prepararGoogle(a)).entregar()
  expect(await banco.sql('SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'repetida' }])
  expect(await banco.sql('SELECT id FROM grupo_importacao')).toHaveLength(1)
  await conferirUnica(a)
})
test.each([false, true])('Google legado respeita vínculo vindo do Banco e cria vínculo na entrega nova (Banco primeiro=%s)', async primeiro => {
  const google = await prepararGoogle(b, [{ ...empresa, google_place_id: 'legado', validado: true }], true)
  const busca = await prepararBanco(a)
  if (primeiro) { await busca.entregar(); await google.entregar() }
  else { await google.entregar(); await busca.entregar() }
  await conferirUnica(primeiro ? a : b)
})
test.each(['pendencia', 'cliente'])('%s existente fica indisponível sem trocar responsável', async tipo => {
  const [{ id }] = await banco.sql<{ id: string }>('INSERT INTO empresa(cnpj,razao_social,telefone) VALUES($1,$2,$3) RETURNING id', [empresa.cnpj, empresa.razao_social, empresa.telefone])
  if (tipo === 'pendencia') await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'multiplos_candidatos','{}')", [id])
  else {
    await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, a])
    await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,current_date,100,$3)', [id, a, randomUUID()])
  }
  const busca = await prepararBanco(b)
  const google = await prepararGoogle(b)
  await Promise.all([busca.entregar(), google.entregar()])
  expect(await banco.sql('SELECT * FROM empresa_vinculo')).toEqual([])
  expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual(tipo === 'cliente' ? [{ vendedor_id: a }] : [])
  expect(await banco.sql('SELECT empresa_id FROM empresa_vinculo_pendencia')).toEqual(tipo === 'pendencia' ? [{ empresa_id: id }] : [])
  expect(await banco.sql('SELECT empresa_id FROM grupo_importacao_empresa')).toEqual([])
})
test.each(['google-banco', 'banco-google', 'banco-banco', 'legado-banco', 'banco-legado', 'legado-legado'].flatMap(ordem => ['telefone', 'email'].map(campo => [ordem, campo])))('contato histórico %s/%s não funde ou entrega outra empresa', async (ordem, campo) => {
  // O cadastro manual conserva outro contato; o contato adquirido só existe no recibo de origem.
  await banco.sql("INSERT INTO empresa(cnpj,razao_social,telefone,email) VALUES($1,'Manual','1133334444','manual@exemplo.test')", [empresa.cnpj])
  const capturada = { ...empresa, email: 'adquirido@exemplo.test' }
  const origem = ordem.startsWith('banco') ? await prepararBanco(a, false, [capturada])
    : await prepararGoogle(a, [{ ...capturada, google_place_id: 'contato-original', validado: true }], ordem.startsWith('legado'))
  await origem.entregar()
  const outra = { ...capturada, cnpj: '99887766000105', razao_social: 'Outra empresa', ...(campo === 'email' ? { telefone: '11977776666', telefones: ['11977776666'] } : { email: null }) }
  const destino = ordem.endsWith('banco') ? await prepararBanco(b, false, [outra])
    : await prepararGoogle(b, [{ ...outra, google_place_id: 'contato-compartilhado', validado: true }], ordem.endsWith('legado'))
  await destino.entregar()
  await conferirUnica(a)
})
test('venda e entrega concorrentes conservam vínculo e responsável sem ciclo de travas', async () => {
  await (await prepararBanco(a)).entregar()
  const [{ empresa_id: id }] = await banco.sql<{ empresa_id: string }>('SELECT empresa_id FROM empresa_vinculo')
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [id, a])
  const [{ id: negociacao }] = await banco.sql<{ id: string }>('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [id, a])
  const google = await prepararGoogle(b)
  const [venda] = await Promise.all([call(a, 'SELECT funil_venda_registrar($1,$2,current_date,100,NULL) r', [negociacao, randomUUID()]), google.entregar()])
  expect(venda).toEqual([{ r: 'ok' }])
  expect(await banco.sql('SELECT vendedor_id FROM empresa_fila')).toEqual([{ vendedor_id: a }])
  expect(await banco.sql('SELECT vendedor_id FROM empresa_vinculo')).toEqual([{ vendedor_id: a }])
  expect(await banco.sql('SELECT situacao FROM google_resultado')).toEqual([{ situacao: 'indisponivel' }])
  expect(await banco.sql('SELECT id FROM venda')).toHaveLength(1)
})
test('resposta paga persiste e falha local, pausa e replay usam o serviço real sem outra chamada ao fornecedor', async () => {
  let chamadas = 0
  const repo = repositorioBusca(a)
  const deps = { repo, configurado: true, cliente: { buscar: async () => { chamadas++; return { ok: true as const, empresas: [empresa] } } } }
  const id = randomUUID()
  expect(await iniciarBusca(deps, id, 'Lojas', filtros)).toEqual({ ok: true, id })
  await call(gestor, 'SELECT busca_empresa_limite_definir($1,1000,true)', [a])
  expect(await garantirInclusao(repo, id)).toEqual({ ok: false, motivo: 'sem_permissao' })
  await call(gestor, 'SELECT busca_empresa_limite_definir($1,1000,false)', [a])
  await banco.sql(`CREATE FUNCTION entrega_teste_falhar() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha local simulada' USING ERRCODE='40001'; END; $$`)
  await banco.sql('CREATE TRIGGER entrega_teste_falhar BEFORE INSERT ON empresa_vinculo FOR EACH ROW EXECUTE FUNCTION entrega_teste_falhar()')
  await expect(garantirInclusao(repo, id)).rejects.toMatchObject({ code: '40001' })
  expect(await banco.sql('SELECT id FROM empresa')).toEqual([])
  expect(await repo.ler(id)).toMatchObject({ estado: 'concluida', empresas: [{ cnpj: empresa.cnpj }], inclusao_automatica_concluida: false })
  await banco.sql('DROP TRIGGER entrega_teste_falhar ON empresa_vinculo')
  await banco.sql('DROP FUNCTION entrega_teste_falhar()')
  expect(await iniciarBusca(deps, id, 'Lojas', filtros)).toEqual({ ok: true, id })
  expect(await garantirInclusao(repo, id)).toMatchObject({ ok: true, inseridas: 1, vinculadas: 1 })
  expect(await garantirInclusao(repo, id)).toMatchObject({ ok: true, inseridas: 0, vinculadas: 1 })
  expect(chamadas).toBe(1)
  await conferirUnica(a)
})
test('helper é interno e recusa chamada direta do aplicativo', async () => {
  await expect(call(a, 'SELECT empresa_vincular_entrega($1,$2,$3)', [randomUUID(), a, 'banco'])).rejects.toMatchObject({ code: '42501' })
  await expect(call(a, 'SELECT empresa_entrega_contato_repetido($1,$2)', ['{}', randomUUID()])).rejects.toMatchObject({ code: '42501' })
})
