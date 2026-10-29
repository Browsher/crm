import { randomUUID } from 'node:crypto'
import type { QueryResultRow } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const filtros = { palavra: 'Armarinhos', cnae: '', uf: 'SP', cidade: 'São Paulo', bairro: 'Brás', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
const empresa = { cnpj: '11222333000181', razao_social: 'Armarinhos fictício LTDA', nome_fantasia: null, email: 'loja@exemplo.test', telefone: '11988887777', cep: null, cnae_principal: '4755502', situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15', logradouro: 'Rua fictícia', numero: '10', complemento: null, bairro: 'Brás', cidade: 'São Paulo', uf: 'SP', telefones: ['11988887777'] }
const segunda = { ...empresa, cnpj: '99887766000105', razao_social: 'Segunda fictícia LTDA', telefone: '11977776666', telefones: ['11977776666'], email: 'segunda@exemplo.test' }
const call = <T extends QueryResultRow = QueryResultRow>(u: string, sql: string, params: unknown[] = []) => banco.comoUsuario(u, e => e<T>(sql, params)).then(r => r.linhas)
const reservar = (id: string, legado = false, u = vendedor) => call(u, `SELECT ${legado ? 'busca_empresa_reservar' : 'busca_empresa_reservar_casa'}($1,$2,$3) resultado`, [id, 'Armarinhos Brás', JSON.stringify(filtros)])
const concluir = (id: string, empresas: unknown[] = [empresa]) => call(vendedor, 'SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify(empresas)])
const importar = (id: string, cnpjs = [empresa.cnpj]) => call<{ grupo_id: string; inseridas: number; vinculadas: number }>(vendedor, 'SELECT * FROM busca_empresa_importar($1,$2)', [id, cnpjs])

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'CasaGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'CasaVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'CasaOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM busca_empresa')
  await banco.sql('DELETE FROM busca_empresa_limite')
  await banco.sql('DELETE FROM empresa_dados_cadastrais')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  for (const id of [vendedor, outro]) await call(gestor, 'SELECT busca_empresa_limite_definir($1,20,false)', [id])
})

test('reserva Casa mantém UUID e cota, com fornecedor persistido', async () => {
  const id = randomUUID()
  await expect(reservar(id)).resolves.toEqual([{ resultado: 'ok' }])
  expect(await reservar(id)).toEqual([{ resultado: 'repetida' }])
  expect(await banco.sql('SELECT fornecedor,quantidade FROM busca_empresa WHERE id=$1', [id])).toEqual([{ fornecedor: 'Casa dos Dados', quantidade: 2 }])
  expect(await banco.sql('SELECT count(*)::int n FROM busca_empresa')).toEqual([{ n: 1 }])
  await expect(reservar(id, false, outro)).rejects.toMatchObject({ code: '42501' })
})

test('operação antiga continua CNPJ.biz e não pode ser reetiquetada como Casa', async () => {
  const id = randomUUID()
  await reservar(id, true)
  await expect(reservar(id)).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT fornecedor FROM busca_empresa WHERE id=$1', [id])).toEqual([{ fornecedor: 'CNPJ.biz' }])
  await concluir(id)
  await importar(id)
  expect(await banco.sql('SELECT fonte FROM empresa_dados_cadastrais')).toEqual([{ fonte: 'CNPJ.biz' }])
})

test('importação Casa usa fonte correta, não toma posse e repete sem nova empresa', async () => {
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  const primeiro = (await importar(id))[0]
  expect(primeiro).toMatchObject({ inseridas: 1, vinculadas: 1 })
  expect((await importar(id))[0]).toEqual({ ...primeiro, inseridas: 0 })
  expect(await banco.sql('SELECT fonte FROM empresa_dados_cadastrais')).toEqual([{ fonte: 'Casa dos Dados' }])
  expect(await banco.sql('SELECT origem FROM grupo_importacao WHERE id=$1', [primeiro.grupo_id])).toEqual([{ origem: 'Casa dos Dados' }])
  expect(await banco.sql('SELECT count(*)::int n FROM empresa_fila')).toEqual([{ n: 0 }])
  expect(await call(outro, 'SELECT id FROM busca_empresa WHERE id=$1', [id])).toEqual([])
})

for (const campo of ['cnpj', 'telefone', 'email'] as const) {
  test(`duplicidade global por ${campo} é marcada e não pode ser importada`, async () => {
    const existente = { ...segunda, [campo]: empresa[campo] }
    if (campo === 'telefone') existente.telefones = [empresa.telefone]
    await banco.sql('INSERT INTO empresa(cnpj,nome_fantasia,telefone,email) VALUES($1,$2,$3,$4)', [existente.cnpj, 'Cadastro manual preservado', existente.telefone, existente.email])
    const antes = await banco.sql('SELECT id,cnpj,nome_fantasia,telefone,email FROM empresa')
    const id = randomUUID()
    await reservar(id)
    await concluir(id)
    expect(await banco.sql("SELECT (empresas->0->>'bloqueada_por_repeticao')::boolean bloqueada FROM busca_empresa WHERE id=$1", [id])).toEqual([{ bloqueada: true }])
    await expect(importar(id)).rejects.toMatchObject({ code: '23505' })
    expect(await banco.sql('SELECT id,cnpj,nome_fantasia,telefone,email FROM empresa')).toEqual(antes)
    expect(await banco.sql('SELECT count(*)::int n FROM grupo_importacao')).toEqual([{ n: 0 }])
  })
}

test('contato repetido dentro do resultado não libera duas empresas', async () => {
  const id = randomUUID()
  await reservar(id)
  await concluir(id, [empresa, { ...segunda, telefone: empresa.telefone, telefones: [empresa.telefone] }])
  expect(await banco.sql("SELECT empresas->0->>'bloqueada_por_repeticao' a,empresas->1->>'bloqueada_por_repeticao' b FROM busca_empresa WHERE id=$1", [id])).toEqual([{ a: 'false', b: 'true' }])
  await expect(importar(id, [empresa.cnpj, segunda.cnpj])).rejects.toMatchObject({ code: '23505' })
  expect((await importar(id))[0]).toMatchObject({ inseridas: 1, vinculadas: 1 })
})

test('rechecagem atômica impede duas importações concorrentes do mesmo contato', async () => {
  const a = randomUUID(), b = randomUUID()
  await reservar(a)
  await reservar(b)
  await concluir(a)
  await concluir(b, [{ ...segunda, telefone: empresa.telefone, telefones: [empresa.telefone] }])
  const resultados = await Promise.allSettled([importar(a), importar(b, [segunda.cnpj])])
  expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(resultados.filter(r => r.status === 'rejected')).toHaveLength(1)
  expect(await banco.sql('SELECT count(*)::int n FROM empresa')).toEqual([{ n: 1 }])
})

test('privacidade de sócios é preservada no contrato Casa', async () => {
  const id = randomUUID()
  await reservar(id)
  await concluir(id, [{ ...empresa, detalhes: { socios: [{ nome: 'Sócio fictício', funcao: { descricao: 'Administrador' }, cnpj_cpf_socio: '***111222**' }] } }])
  const proprio = await call(vendedor, 'SELECT empresas FROM busca_empresa WHERE id=$1', [id])
  expect(JSON.stringify(proprio)).toContain('Sócio fictício')
  expect(JSON.stringify(proprio)).not.toContain('111222')
  expect(await call(vendedor, 'SELECT dados FROM busca_empresa_socios WHERE busca_id=$1', [id])).toEqual([])
  expect(await call(gestor, 'SELECT jsonb_array_length(dados)::int n FROM busca_empresa_socios WHERE busca_id=$1', [id])).toEqual([{ n: 1 }])
})

test('telefone principal também é comparado aos contatos secundários já cadastrados', async () => {
  const [{ id: existente }] = await banco.sql<{ id: string }>('INSERT INTO empresa(cnpj,nome_fantasia,telefone,email) VALUES($1,$2,$3,$4) RETURNING id', [segunda.cnpj, 'Cadastro manual', segunda.telefone, segunda.email])
  await banco.sql("INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,telefones) VALUES($1,'CNPJ.biz',now(),$2)", [existente, JSON.stringify([empresa.telefone])])
  const id = randomUUID()
  await reservar(id)
  await concluir(id, [{ ...empresa, telefones: [] }])
  expect(await banco.sql("SELECT (empresas->0->>'bloqueada_por_repeticao')::boolean bloqueada FROM busca_empresa WHERE id=$1", [id])).toEqual([{ bloqueada: true }])
  await expect(importar(id)).rejects.toMatchObject({ code: '23505' })
})
