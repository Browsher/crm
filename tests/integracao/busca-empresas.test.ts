import type { QueryResultRow } from 'pg'
import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const filtros: FiltrosBusca = { palavra: 'iluminação', cnae: '', uf: 'SP', cidade: '', bairro: '', porte: '', tipo: '', contato: 'telefoneoucelular', quantidade: 2, offset: 0 }
const empresa = { cnpj: '11222333000181', razao_social: 'Loja teste LTDA', nome_fantasia: 'Loja teste', email: 'loja@exemplo.test',
  telefone: '11988887777', cep: '01001000', cnae_principal: '4742300', situacao: 'ATIVA', porte: 'ME', data_abertura: '2020-01-15',
  logradouro: 'Praça teste', numero: '10', complemento: 'Sala 2', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', telefones: ['11988887777'] }
const chamar = <T extends QueryResultRow = { resultado: string }>(usuario: string, sql: string, params: unknown[]) => banco.comoUsuario(usuario, e => e<T>(sql, params)).then(r => r.linhas)
const configurar = (limite = 4, pausado = false) => chamar(gestor, 'SELECT busca_empresa_limite_definir($1,$2,$3)', [vendedor, limite, pausado])
const reservar = (id = randomUUID(), usuario = vendedor, f = filtros) => chamar(usuario, 'SELECT busca_empresa_reservar($1,$2,$3) AS resultado', [id, 'Lojas SP', JSON.stringify(f)])
const concluir = (id: string, empresas: unknown[] = [empresa], usuario = vendedor) => chamar(usuario, 'SELECT busca_empresa_concluir($1,$2,NULL)', [id, JSON.stringify(empresas)])
const importar = (id: string, cnpjs = [empresa.cnpj], usuario = vendedor) => chamar<{ grupo_id: string; inseridas: number; vinculadas: number }>(usuario, 'SELECT * FROM busca_empresa_importar($1,$2)', [id, cnpjs])

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'BuscaGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'BuscaVendedor')
  outro = await criarUsuario(banco, 'vendedor', 'BuscaOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM busca_empresa')
  await banco.sql('DELETE FROM busca_empresa_limite')
  await banco.sql('DELETE FROM empresa_dados_cadastrais')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
  await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false WHERE id=$1', [vendedor])
})
test('sem limite configurado não permite consulta', async () => {
  expect(await reservar()).toEqual([{ resultado: 'limite' }])
})
test('apenas gestor configura limite e senha provisória impede escrita', async () => {
  await expect(chamar(vendedor, 'SELECT busca_empresa_limite_definir($1,10,false)', [vendedor])).rejects.toMatchObject({ code: '42501' })
  await configurar()
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [vendedor])
  await expect(reservar()).rejects.toMatchObject({ code: '42501' })
})
test('quota concorrente é reservada antes do HTTP sem ultrapassar o limite', async () => {
  await configurar(2)
  const resultados = await Promise.all([reservar(), reservar(), reservar()])
  expect(resultados.flat().map(r => r.resultado).sort()).toEqual(['limite', 'limite', 'ok'])
  expect(await banco.sql('SELECT count(*)::int AS n FROM busca_empresa')).toEqual([{ n: 1 }])
})
test('repetir mesma chave não consome novamente, divergência é recusada', async () => {
  await configurar(2)
  const id = randomUUID()
  expect(await reservar(id)).toEqual([{ resultado: 'ok' }])
  expect(await reservar(id)).toEqual([{ resultado: 'repetida' }])
  await expect(reservar(id, vendedor, { ...filtros, palavra: 'outro' })).rejects.toMatchObject({ code: '22023' })
  await expect(reservar(id, outro)).rejects.toMatchObject({ code: '42501' })
})
test('pausa bloqueia consulta e importação, mas preserva resultado em andamento', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await configurar(4, true)
  expect(await reservar()).toEqual([{ resultado: 'pausada' }])
  await concluir(id)
  await expect(importar(id)).rejects.toMatchObject({ code: '42501' })
})
test('buscas são isoladas por usuário, gestor pode acompanhar todas', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  expect(await chamar(outro, 'SELECT id FROM busca_empresa', [])).toEqual([])
  expect(await chamar(gestor, 'SELECT id FROM busca_empresa', [])).toEqual([{ id }])
  await expect(concluir(id, [empresa], outro)).rejects.toMatchObject({ code: '42501' })
})
test('importa seleção em grupo, preserva campos adicionais e não assume a carteira', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  const [r] = await importar(id)
  expect(r).toMatchObject({ inseridas: 1, vinculadas: 1 })
  expect(await banco.sql('SELECT cnpj,telefone,email,criado_por FROM empresa')).toEqual([{ cnpj: empresa.cnpj, telefone: empresa.telefone, email: empresa.email, criado_por: vendedor }])
  expect(await banco.sql('SELECT fonte,numero,porte FROM empresa_dados_cadastrais')).toEqual([{ fonte: 'CNPJ.biz', numero: '10', porte: 'ME' }])
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual([])
  expect(await importar(id)).toEqual([{ ...r, inseridas: 0 }])
})
test('cnpj existente conserva cadastro e vínculo comercial, sem sobrescrever', async () => {
  await configurar()
  const [{ id: empresaId }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone,email) VALUES ($1,'Nome revisado','1133332222','revisado@exemplo.test') RETURNING id", [empresa.cnpj])
  const id = randomUUID()
  await reservar(id)
  await concluir(id)
  expect(await importar(id)).toMatchObject([{ inseridas: 0, vinculadas: 1 }])
  expect(await banco.sql('SELECT id,razao_social,telefone,email FROM empresa')).toEqual([{ id: empresaId, razao_social: 'Nome revisado', telefone: '1133332222', email: 'revisado@exemplo.test' }])
})
test('resultado incompleto permanece salvo, telefone ausente e seleção adulterada não entram na fila', async () => {
  await configurar()
  const id = randomUUID()
  await reservar(id)
  await concluir(id, [{ ...empresa, telefone: null, telefones: [] }])
  expect(await chamar(vendedor, 'SELECT jsonb_array_length(empresas)::int AS n FROM busca_empresa WHERE id=$1', [id])).toEqual([{ n: 1 }])
  await expect(importar(id)).rejects.toMatchObject({ code: '22023' })
  await expect(importar(id, ['11444777000161'])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 0 }])
})
test('falha conserva quota e não permite resultado maior que a solicitação', async () => {
  await configurar(2)
  const id = randomUUID()
  await reservar(id)
  await expect(concluir(id, [empresa, empresa, empresa])).rejects.toMatchObject({ code: '22023' })
  await chamar(vendedor, "SELECT busca_empresa_concluir($1,'[]','tempo_esgotado')", [id])
  expect(await reservar()).toEqual([{ resultado: 'limite' }])
  await expect(concluir(id)).rejects.toMatchObject({ code: '22023' })
})
test('tabelas não aceitam escrita direta nem dados cadastrais de empresa invisível', async () => {
  await expect(chamar(vendedor, 'INSERT INTO busca_empresa_limite(usuario_id,limite_diario) VALUES ($1,1000)', [vendedor])).rejects.toMatchObject({ code: '42501' })
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('11222333000181','Oculta','11988887777') RETURNING id")
  await banco.sql("INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,telefones) VALUES ($1,'CNPJ.biz',now(),'[]')", [id])
  expect(await chamar(vendedor, 'SELECT * FROM empresa_dados_cadastrais', [])).toEqual([])
})

test('repositório real lê somente a busca própria e informa o consumo de São Paulo', async () => {
  const { repositorioBusca } = await import('@/src/features/busca-empresas/repositorio')
  await configurar(4)
  const repo = repositorioBusca(vendedor)
  const id = randomUUID()
  expect(await repo.reservar(id, 'Lojas SP', filtros)).toEqual({ ok: true, repetida: false })
  await repo.concluir(id, { ok: true, empresas: [empresa] })
  expect(await repo.ler(id)).toMatchObject({ id, estado: 'concluida', empresas: [empresa] })
  expect(await repositorioBusca(outro).ler(id)).toBeNull()
  expect(await repo.meuLimite()).toMatchObject({ limite_diario: 4, usado: 2 })
})
