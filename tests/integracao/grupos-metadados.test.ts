import { confirmarImportacaoHistorica } from './fixtures/importacao-historica'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { atualizarMetadadosGrupo, detalharGrupo } from '@/src/features/empresas/grupos'
import { criarBancoDeTeste, criarUsuario, criarUsuarioComSenha, type BancoDeTeste } from './ajuda'
let banco: BancoDeTeste
let gestor: string
let vendedor: string
let pendente: string
const metadados = { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }
const linhas = [{ cnpj: '11222333000181', razao_social: 'Aurora', telefone: '11987654321' }]
const parametros = (contexto: unknown = metadados, chave = randomUUID()) => [chave, 'Mooca', 'mooca.csv', 'a'.repeat(64), JSON.stringify(linhas), '{"novas":1}', JSON.stringify(contexto)]
async function confirmar(contexto: unknown = metadados, chave = randomUUID(), usuario = gestor) {
  return (await confirmarImportacaoHistorica<{grupo_id: string; inseridas: number; vinculadas: number; relatorio: unknown}>(banco, usuario, parametros(contexto, chave))).linhas[0]
}
async function fotografia() {
  return Promise.all(['grupo_importacao', 'grupo_importacao_empresa', 'empresa', 'empresa_origem_google'].map(tabela => banco.sql(`SELECT * FROM ${tabela} ORDER BY 1,2`)))
}
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'MetadadosGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'MetadadosVendedor')
  pendente = (await criarUsuarioComSenha(banco, 'gestor', 'MetadadosPendente', 'Senha-teste-2026', { pendente: true })).id
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql('DELETE FROM empresa_origem_google')
  await banco.sql('DELETE FROM empresa')
})
test('confirmação conserva contexto no pedido/apresentação e repetição retorna resultado persistido', async () => {
  const chave = randomUUID()
  const r = await confirmar(metadados, chave)
  const [grupo] = await banco.sql<Record<string, unknown>>('SELECT * FROM grupo_importacao WHERE id=$1', [r.grupo_id])
  expect(grupo).toMatchObject({ ...metadados, pedido: { nome: 'Mooca', arquivo: 'mooca.csv', linhas, metadados } })
  expect(await confirmar(metadados, chave)).toEqual(r)
  const antes = await fotografia()
  await expect(confirmar({ ...metadados, origem: 'Outra origem' }, chave)).rejects.toMatchObject({ code: '22023' })
  expect(await fotografia()).toEqual(antes)
})
test('correção do gestor atualiza apresentação/auditoria e preserva pedido, resultado e replay', async () => {
  const chave = randomUUID()
  const r = await confirmar(metadados, chave)
  const [antes] = await banco.sql<Record<string, unknown>>('SELECT * FROM grupo_importacao WHERE id=$1', [r.grupo_id])
  expect(await atualizarMetadadosGrupo(gestor, r.grupo_id, { descricao: ' Loja\r\nCFTV ', origem: ' Coleta direta ', criterios: ' Telefone ' })).toEqual({ ok: true })
  const [depois] = await banco.sql<Record<string, unknown>>('SELECT * FROM grupo_importacao WHERE id=$1', [r.grupo_id])
  expect(depois).toMatchObject({ descricao: 'Loja\nCFTV', origem: 'Coleta direta', criterios: 'Telefone', atualizado_por: gestor, pedido: antes.pedido, relatorio: antes.relatorio })
  expect(depois.atualizado_em).not.toEqual(antes.atualizado_em)
  expect(await confirmar(metadados, chave)).toEqual(r)
  const detalhe = await detalharGrupo(gestor, r.grupo_id)
  expect(detalhe).toMatchObject({ ok: true, grupo: { descricao: 'Loja\nCFTV', origem: 'Coleta direta', criterios: 'Telefone' } })
})
test('normalização SQL de CRLF/CR e vazio opcional coincide com a confirmação normalizada', async () => {
  const chave = randomUUID()
  const r = await confirmar({ descricao: ' Mooca\r\nCFTV \r', origem: ' Google Maps ', criterios: '\r\n ' }, chave)
  expect(await confirmar({ descricao: 'Mooca\nCFTV', origem: 'Google Maps', criterios: null }, chave)).toEqual(r)
  expect(await banco.sql('SELECT descricao,origem,criterios FROM grupo_importacao')).toEqual([{ descricao: 'Mooca\nCFTV', origem: 'Google Maps', criterios: null }])
})
test.each(['descricao', 'origem', 'criterios'] as const)('SQL aceita limite Unicode de %s e nega caractere excedente atomicamente', async campo => {
  const limite = campo === 'criterios' ? 2000 : 500
  const valido = { ...metadados, [campo]: '📷'.repeat(limite) }
  const r = await confirmar(valido)
  expect(await banco.sql(`SELECT length(${campo}) AS n FROM grupo_importacao WHERE id=$1`, [r.grupo_id])).toEqual([{ n: limite }])
  const antes = await fotografia()
  await expect(confirmar({ ...metadados, [campo]: '📷'.repeat(limite + 1) })).rejects.toMatchObject({ code: '22023' })
  await expect(banco.comoUsuario(gestor, e => e('SELECT grupo_importacao_metadados_definir($1,$2,$3,$4)', [r.grupo_id, campo === 'descricao' ? '📷'.repeat(501) : 'Resumo', campo === 'origem' ? '📷'.repeat(501) : 'Origem', campo === 'criterios' ? '📷'.repeat(2001) : null]))).rejects.toMatchObject({ code: '22023' })
  expect(await fotografia()).toEqual(antes)
})
test.each([
  null, [], {}, { origem: 'Maps', criterios: null }, { ...metadados, adicional: 'x' },
  { ...metadados, descricao: 1 }, { ...metadados, origem: null }, { ...metadados, criterios: [] },
  { ...metadados, descricao: '' }, { ...metadados, origem: ' \r ' },
  { ...metadados, descricao: 'Mooca\u0001' }, { ...metadados, origem: 'Maps\t' },
  { ...metadados, criterios: 'Telefone\u0080' }, { ...metadados, descricao: 'Mooca\u007f' },
])('SQL rejeita JSON inválido/controles sem gravar: %j', async contexto => {
  await expect(confirmar(contexto)).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 0 }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{ n: 0 }])
})
test('CHECKs conservam textos normalizados e limites, inclusive em escrita privilegiada direta', async () => {
  const r = await confirmar()
  for (const texto of [' Mooca', 'Mooca\r\nCFTV', 'Mooca\t', 'Mooca\u009f', '📷'.repeat(501), '']) {
    await expect(banco.sql('UPDATE grupo_importacao SET descricao=$2 WHERE id=$1', [r.grupo_id, texto])).rejects.toMatchObject({ code: '23514' })
  }
  await banco.sql('UPDATE grupo_importacao SET descricao=$2 WHERE id=$1', [r.grupo_id, '📷'.repeat(500)])
})
test('vendedor e gestor com senha provisória não confirmam nem corrigem pelo SQL', async () => {
  const r = await confirmar()
  const antes = await fotografia()
  for (const usuario of [vendedor, pendente]) {
    await expect(confirmar(metadados, randomUUID(), usuario)).rejects.toMatchObject({ code: '42501' })
    await expect(banco.comoUsuario(usuario, e => e('SELECT grupo_importacao_metadados_definir($1,$2,$3,$4)', [r.grupo_id, 'Resumo', 'Origem', null]))).rejects.toMatchObject({ code: '42501' })
  }
  await expect(banco.comoUsuario(gestor, e => e("UPDATE grupo_importacao SET origem='Bypass' WHERE id=$1", [r.grupo_id]))).rejects.toMatchObject({ code: '42501' })
  expect(await fotografia()).toEqual(antes)
})
test('grupos históricos com três nulos continuam legíveis; correção ausente retorna não encontrado', async () => {
  const [antigo] = await banco.sql<{id:string}>("INSERT INTO grupo_importacao(nome) VALUES ('Histórico') RETURNING id")
  expect(await detalharGrupo(gestor, antigo.id)).toMatchObject({ ok: true, grupo: { descricao: null, origem: null, criterios: null } })
  expect(await atualizarMetadadosGrupo(gestor, randomUUID(), metadados)).toEqual({ ok: false, motivo: 'nao_encontrado' })
})
test('somente assinatura de sete argumentos existe; auxiliares e PUBLIC não têm caminhos privilegiados', async () => {
  expect(await banco.sql("SELECT to_regprocedure('grupo_importacao_confirmar(uuid,text,text,text,jsonb,jsonb)')::text AS antiga")).toEqual([{ antiga: null }])
  const funcoes = await banco.sql<{ nome: string; argumentos: number; app: boolean; publico: boolean }>(`SELECT p.proname AS nome,p.pronargs AS argumentos,
    has_function_privilege('app_usuario',p.oid,'EXECUTE') AS app,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS publico
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('grupo_importacao_confirmar','grupo_importacao_metadados_definir','grupo_importacao_texto_normalizar','grupo_importacao_texto_valido')`)
  expect(funcoes).toHaveLength(4)
  expect(funcoes.every(f => !f.publico)).toBe(true)
  expect(funcoes.find(f => f.nome === 'grupo_importacao_confirmar')).toMatchObject({ argumentos: 7, app: false })
  expect(funcoes.filter(f => f.nome.startsWith('grupo_importacao_texto_')).every(f => !f.app)).toBe(true)
})


test('espaços Unicode, ZWJ e separadores Unicode permitidos pelo contrato não são controles C0/C1', async () => {
  const descricao = '\u00a0👩‍💻\u2028Mooca\u00a0'
  const r = await confirmar({ ...metadados, descricao })
  expect(await banco.sql('SELECT descricao FROM grupo_importacao WHERE id=$1', [r.grupo_id])).toEqual([{ descricao }])
})
