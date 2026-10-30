import { repositorioHistorico, confirmarImportacaoHistorica } from './fixtures/importacao-historica'
import { contatoDireto } from './fixtures/contato-direto'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { CABECALHO_GOOGLE } from '@/src/features/empresas/planilha'
import { analisar, importar } from '@/src/features/empresas/servico'
import { textoDoMotivo } from '@/src/features/empresas/mensagens'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let outro: string
const prospect = (id = 'ChIJ-ficticio-a') => ({ cnpj: null, razao_social: null, nome_fantasia: 'Câmeras Aurora', telefone: '11987654321', google_place_id: id })
async function confirmar(linhas: unknown[], chave = randomUUID(), usuario = gestor) {
  const r = await confirmarImportacaoHistorica<{ grupo_id: string; inseridas: number; vinculadas: number; relatorio: unknown }>(banco, usuario,
    [chave, 'Mooca', 'mooca.csv', 'a'.repeat(64), JSON.stringify(linhas), JSON.stringify({ novas: linhas.length }), JSON.stringify({ descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null })],
  )
  return r.linhas[0]
}
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'OrigemGestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'OrigemVendedor')
  outro = await criarUsuario(banco, 'gestor', 'OrigemOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM empresa_atendimento_operacao; DELETE FROM empresa_vinculo; DELETE FROM negociacao')
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM fila_contexto')
  await banco.sql('DELETE FROM grupo_importacao_empresa')
  await banco.sql('DELETE FROM grupo_importacao')
  await banco.sql("DO $$ BEGIN IF to_regclass('empresa_origem_google') IS NOT NULL THEN DELETE FROM empresa_origem_google; END IF; END $$")
  await banco.sql('DELETE FROM empresa')
})
test('cria dois prospects nulos com Place IDs distintos, mesmo telefone e auditoria', async () => {
  await expect(confirmar([prospect(), prospect('ChIJ-ficticio-b')])).resolves.toMatchObject({ inseridas: 2, vinculadas: 2 })
  expect(await banco.sql('SELECT cnpj,razao_social,criado_por FROM empresa')).toEqual([
    { cnpj: null, razao_social: null, criado_por: gestor }, { cnpj: null, razao_social: null, criado_por: gestor },
  ])
  expect(await banco.sql('SELECT criado_por FROM empresa_origem_google')).toEqual([{ criado_por: gestor }, { criado_por: gestor }])
})
test('reimportação conserva UUID em dois grupos e mesma chave retorna resultado original', async () => {
  const chave = randomUUID()
  const a = await confirmar([prospect()], chave)
  expect(await confirmar([prospect()], chave)).toEqual(a)
  const [{ id }] = await banco.sql<{ id: string }>('SELECT id FROM empresa')
  const b = await confirmar([prospect()])
  expect(b).toMatchObject({ inseridas: 0, vinculadas: 1 })
  expect(await banco.sql('SELECT empresa_id FROM grupo_importacao_empresa')).toEqual([{ empresa_id: id }, { empresa_id: id }])
})
test('completa somente CNPJ e razão social vazios e conserva contato e carteira', async () => {
  await confirmar([prospect()])
  const [{ id }] = await banco.sql<{ id: string }>('SELECT id FROM empresa')
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'google')",[id,vendedor])
  expect(await contatoDireto(banco,vendedor,id,{tipo:'interessado',nota:'Anotação preservada',proximoPasso:null,proximoPassoData:null})).toMatchObject({ok:true})
  const contatos = await banco.sql('SELECT * FROM contato')
  const carteira = await banco.sql('SELECT * FROM empresa_fila')
  expect(await confirmar([{ ...prospect(), cnpj: '11222333000181', razao_social: 'Aurora LTDA', telefone: '1134567890', nome_fantasia: 'Outro nome' }])).toMatchObject({ inseridas: 0 })
  expect(await banco.sql('SELECT id,cnpj,razao_social,nome_fantasia,telefone FROM empresa')).toEqual([{ id, cnpj: '11222333000181', razao_social: 'Aurora LTDA', nome_fantasia: 'Câmeras Aurora', telefone: '11987654321' }])
  expect(await banco.sql('SELECT * FROM contato')).toEqual(contatos)
  expect(await banco.sql('SELECT * FROM empresa_fila')).toEqual(carteira)
})
test('dois UUIDs divergentes recusam com rollback de todo lote', async () => {
  await confirmar([{ ...prospect('ChIJ-a'), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }, prospect('ChIJ-b')])
  const antes = await banco.sql('SELECT * FROM empresa ORDER BY id')
  await expect(confirmar([prospect('ChIJ-nova'), { ...prospect('ChIJ-b'), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT * FROM empresa ORDER BY id')).toEqual(antes)
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})
test('um CNPJ reconhece dois Place IDs em arquivos diferentes', async () => {
  const l = { ...prospect(), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }
  await confirmar([l])
  expect(await confirmar([{ ...l, google_place_id: 'ChIJ-b' }])).toMatchObject({ inseridas: 0 })
  expect(await banco.sql('SELECT count(DISTINCT empresa_id)::int AS n FROM empresa_origem_google')).toEqual([{ n: 1 }])
})
test('Place ID único e nenhuma escrita direta para aplicação', async () => {
  await confirmar([prospect()])
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(nome_fantasia,telefone) VALUES ('Outro','11987654321') RETURNING id")
  await expect(banco.sql('INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES ($1,$2)', ['ChIJ-ficticio-a', id])).rejects.toMatchObject({ code: '23505' })
  expect((await banco.comoUsuario(vendedor, e => e('SELECT * FROM empresa_origem_google'))).linhas).toEqual([])
  for (const sql of ['DELETE FROM empresa_origem_google', "UPDATE empresa_origem_google SET google_place_id='x'", `INSERT INTO empresa_origem_google(google_place_id,empresa_id) VALUES ('x','${id}')`]) {
    await expect(banco.comoUsuario(gestor, e => e(sql))).rejects.toMatchObject({ code: '42501' })
  }
})
test('vendedor, gestor inativo e senha provisória não confirmam', async () => {
  await expect(confirmar([prospect()], randomUUID(), vendedor)).rejects.toMatchObject({ code: '42501' })
  for (const campo of ['ativo=false', 'senha_provisoria_pendente=true']) {
    await banco.sql(`UPDATE usuario SET ${campo} WHERE id=$1`, [outro])
    await expect(confirmar([prospect()], randomUUID(), outro)).rejects.toMatchObject({ code: '42501' })
    await banco.sql('UPDATE usuario SET ativo=true,senha_provisoria_pendente=false WHERE id=$1', [outro])
  }
})
test.each(['11222333000181', '12ABC34501DE35'])('confirma CNPJ com DV correto %s', async cnpj => {
  await expect(confirmar([{ ...prospect(), cnpj, razao_social: 'Aurora LTDA' }])).resolves.toMatchObject({ inseridas: 1 })
})
test.each(['11222333000182', '12ABC34501DE36', '00000000000000'])('recusa CNPJ inválido informado %s', async cnpj => {
  await expect(confirmar([{ ...prospect(), cnpj }])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT * FROM empresa')).toEqual([])
})
test('divergência de CNPJ ou razão social e duplicatas recusam lote inteiro', async () => {
  const l = { ...prospect(), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }
  await confirmar([l])
  for (const linhas of [[{ ...l, cnpj: '11444777000161' }], [{ ...l, razao_social: 'Outra LTDA' }], [l, l], [l, { ...l, google_place_id: 'ChIJ-b' }], [prospect('ChIJ-b'), prospect('ChIJ-b')]]) {
    await expect(confirmar(linhas)).rejects.toMatchObject({ code: '22023' })
  }
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})


test('confirmação antiga também valida DV e razão social conhecida', async () => {
  await expect(confirmar([{ cnpj: '11222333000182', razao_social: 'Aurora LTDA', telefone: '11987654321' }])).rejects.toMatchObject({ code: '22023' })
  await confirmar([{ cnpj: '11222333000181', razao_social: 'Aurora LTDA', telefone: '11987654321' }])
  await expect(confirmar([{ cnpj: '11222333000181', razao_social: 'Outra LTDA', telefone: '11987654321' }])).rejects.toMatchObject({ code: '22023' })
})


test.each(['', ' x', 'x ', 'x'.repeat(256), 'a\u0001b', 'a\u0085b'])('SQL recusa Place ID inválido %s sem gravação parcial', async google_place_id => {
  await expect(confirmar([{ ...prospect(), google_place_id }])).rejects.toMatchObject({ code: '22023' })
  expect(await banco.sql('SELECT * FROM empresa')).toEqual([])
  expect(await banco.sql('SELECT * FROM grupo_importacao')).toEqual([])
})
test('helper de DV não tem execução para PUBLIC nem aplicação', async () => {
  expect(await banco.sql("SELECT has_function_privilege('app_usuario','empresa_cnpj_valido(text)','EXECUTE') AS app, has_function_privilege('app_conferencia','empresa_cnpj_valido(text)','EXECUTE') AS publico")).toEqual([{ app: false, publico: false }])
  await expect(banco.comoUsuario(gestor, e => e("SELECT empresa_cnpj_valido('11222333000181')"))).rejects.toMatchObject({ code: '42501' })
})
test('conflito surgido após análise produz nova conferência sem salvar parte do lote', async () => {
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([
    CABECALHO_GOOGLE,
    ',,Nova,,11987654321,,,,ChIJ-nova',
    '11222333000181,Aurora LTDA,,,11987654321,,,,ChIJ-conflito',
  ].join('\n'))
  expect(await analisar(repo, fonte)).toMatchObject({ ok: true, relatorio: { novas: 2, jaCadastradas: 0 } })
  expect(await banco.sql('SELECT * FROM empresa')).toEqual([])
  const gravar = repo.gravar
  repo.gravar = async (...argumentos) => {
    await confirmar([{ ...prospect('ChIJ-conflito'), cnpj: '11444777000161', razao_social: 'Outro cadastro' }])
    return gravar(...argumentos)
  }
  const r = await importar(repo, fonte, { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }, { linhasAceitas: [2, 3], recusadasIdentidade: [] })
  expect(r).toEqual({ ok: false, motivo: 'confirmacao_invalida' })
  expect(textoDoMotivo('confirmacao_invalida')).toBe('A confirmação mudou. Confira o arquivo novamente.')
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
  expect(await banco.sql('SELECT google_place_id FROM empresa_origem_google')).toEqual([{ google_place_id: 'ChIJ-conflito' }])
})


test.each([true, false])('conflito antes da reanálise não muda seleção aprovada, lote misto=%s', async misto => {
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([
    CABECALHO_GOOGLE,
    '11222333000181,Aurora LTDA,,,11987654321,,,,ChIJ-conflito',
    ...(misto ? [',,Nova,,11987654321,,,,ChIJ-nova'] : []),
  ].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava análise válida')
  await confirmar([{ ...prospect('ChIJ-conflito'), cnpj: '11444777000161', razao_social: 'Outro cadastro' }])
  const antes = await banco.sql('SELECT * FROM empresa ORDER BY id')
  const r = await importar(repo, fonte, { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }, conferido.conferencia)
  expect(r).toEqual({ ok: false, motivo: 'confirmacao_invalida' })
  expect(await banco.sql('SELECT * FROM empresa ORDER BY id')).toEqual(antes)
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})
test('recusa preexistente não amplia seleção quando deixa de divergir', async () => {
  const repo = repositorioHistorico(banco, gestor)
  await confirmar([{ ...prospect('ChIJ-conflito'), cnpj: '11444777000161', razao_social: 'Outra LTDA' }])
  const fonte = new TextEncoder().encode([CABECALHO_GOOGLE, '11222333000181,Aurora LTDA,,,11987654321,,,,ChIJ-conflito', ',,Nova,,11987654321,,,,ChIJ-nova'].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava análise válida')
  expect(conferido.relatorio).toMatchObject({ novas: 1, recusadas: [{ tipo: 'identidade', motivo: 'cnpj_divergente' }] })
  await banco.sql("UPDATE empresa SET cnpj='11222333000181',razao_social='Aurora LTDA'")
  const r = await importar(repo, fonte, { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }, conferido.conferencia)
  expect(r).toMatchObject({ ok: true, inseridas: 1, vinculadas: 1, relatorio: { novas: 1, jaCadastradas: 0, recusadas: [{ tipo: 'identidade', motivo: 'cnpj_divergente' }] } })
})
test('replay da seleção aprovada permanece válido após divergência cadastral posterior', async () => {
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([CABECALHO_GOOGLE, '11222333000181,Aurora LTDA,,,11987654321,,,,ChIJ-conflito'].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava análise válida')
  const op = { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }
  const primeira = await importar(repo, fonte, op, conferido.conferencia)
  expect(primeira).toMatchObject({ ok: true, inseridas: 1 })
  await banco.sql("UPDATE empresa SET cnpj='11444777000161',razao_social='Outra LTDA'")
  expect(await importar(repo, fonte, op, conferido.conferencia)).toEqual(primeira)
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})

test.each([['origens sem CNPJ', ''], ['CNPJ e origem', '11222333000181']] as const)('conferência real recusa UUID repetido por %s e confirma a terceira empresa', async (_rotulo, cnpj) => {
  const existente = { ...prospect('ChIJ-a'), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }
  await confirmar([existente])
  await confirmar([{ ...existente, google_place_id: 'ChIJ-b' }])
  const antes = await banco.sql('SELECT * FROM empresa ORDER BY id')
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([
    CABECALHO_GOOGLE,
    `${cnpj},,Aurora,,11987654321,,,,${cnpj ? '' : 'ChIJ-a'}`,
    ',,Aurora,,11987654321,,,,ChIJ-b',
    ',,Aurora,,11987654321,,,,ChIJ-terceira',
  ].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava conferência válida')
  expect(conferido.relatorio).toMatchObject({ novas: 1, jaCadastradas: 0, recusadas: [
    { tipo: 'identidade', linha: 2, motivo: 'empresa_repetida' },
    { tipo: 'identidade', linha: 3, motivo: 'empresa_repetida' },
  ] })
  expect(conferido.conferencia.linhasAceitas).toEqual([4])
  expect(await banco.sql('SELECT * FROM empresa ORDER BY id')).toEqual(antes)
  const r = await importar(repo, fonte, { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }, conferido.conferencia)
  expect(r).toMatchObject({ ok: true, inseridas: 1, vinculadas: 1, relatorio: conferido.relatorio })
  if (!r.ok) throw new Error('esperava confirmação válida')
  expect(await banco.sql('SELECT o.google_place_id FROM grupo_importacao_empresa g JOIN empresa_origem_google o USING (empresa_id) WHERE g.grupo_id=$1', [r.grupoId])).toEqual([{ google_place_id: 'ChIJ-terceira' }])
  expect(await banco.sql('SELECT count(*)::int AS n FROM empresa')).toEqual([{ n: 2 }])
})

test('UUID repetido surgido após conferir chega ao SQL sem reduzir seleção original', async () => {
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([CABECALHO_GOOGLE,
    '11222333000181,Aurora LTDA,,,11987654321,,,,',
    ',,Aurora,,11987654321,,,,ChIJ-b',
    ',,Nova,,11987654321,,,,ChIJ-nova',
  ].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava conferência válida')
  expect(conferido.conferencia.linhasAceitas).toEqual([2, 3, 4])
  await confirmar([{ ...prospect('ChIJ-b'), cnpj: '11222333000181', razao_social: 'Aurora LTDA' }])
  const antes = await banco.sql('SELECT * FROM empresa ORDER BY id')
  expect(await importar(repo, fonte, { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }, conferido.conferencia)).toEqual({ ok: false, motivo: 'confirmacao_invalida' })
  expect(await banco.sql('SELECT * FROM empresa ORDER BY id')).toEqual(antes)
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})

test('replay do recibo anterior conserva resultado mesmo após origens resolverem para o mesmo UUID', async () => {
  const repo = repositorioHistorico(banco, gestor)
  const fonte = new TextEncoder().encode([CABECALHO_GOOGLE,
    ',,Aurora,,11987654321,,,,ChIJ-a',
    ',,Aurora,,11987654321,,,,ChIJ-b',
  ].join('\n'))
  const conferido = await analisar(repo, fonte)
  if (!conferido.ok) throw new Error('esperava conferência válida')
  const op = { chave: randomUUID(), nome: 'Mooca', arquivoNome: 'mooca.csv', metadados: { descricao: 'Mooca CFTV', origem: 'Google Maps', criterios: null }, assinatura: 'a'.repeat(64) }
  const primeira = await importar(repo, fonte, op, conferido.conferencia)
  expect(primeira).toMatchObject({ ok: true, inseridas: 2, vinculadas: 2 })
  // Mudança posterior apenas no banco temporário: o replay deve preceder a resolução.
  await banco.sql("UPDATE empresa_origem_google SET empresa_id=(SELECT empresa_id FROM empresa_origem_google WHERE google_place_id='ChIJ-a') WHERE google_place_id='ChIJ-b'")
  expect(await analisar(repo, fonte)).toMatchObject({ ok: true, conferencia: { linhasAceitas: [] }, relatorio: { novas: 0, jaCadastradas: 0, recusadas: [
    { tipo: 'identidade', linha: 2, motivo: 'empresa_repetida' },
    { tipo: 'identidade', linha: 3, motivo: 'empresa_repetida' },
  ] } })
  expect(await importar(repo, fonte, op, conferido.conferencia)).toEqual(primeira)
  expect(await banco.sql('SELECT count(*)::int AS n FROM grupo_importacao')).toEqual([{ n: 1 }])
})
