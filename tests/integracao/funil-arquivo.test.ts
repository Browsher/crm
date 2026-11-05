import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import * as consulta from '@/src/features/funil/consulta'
import * as operacoes from '@/src/server/atendimento/operacoes'
import type { ResultadoAtendimento } from '@/src/lib/atendimento'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularEmpresaTeste } from './atendimento-fixtures'

let banco: BancoDeTeste
let vendedor: string
let outro: string
let gestor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'ArquivoFunil')
  outro = await criarUsuario(banco, 'vendedor', 'OutroArquivoFunil')
  gestor = await criarUsuario(banco, 'gestor', 'GestorArquivoFunil')
})
afterAll(async () => { await banco?.derrubar() })

function sucesso(resultado: ResultadoAtendimento) {
  expect(resultado).toMatchObject({ ok: true, repetida: false })
  if (!resultado.ok) throw new Error('Operação de preparação recusada')
  return resultado.versao
}

async function abrir(nome: string, dono = vendedor) {
  const [{ id: empresaId }] = await banco.sql<{ id: string }>(
    "INSERT INTO empresa(razao_social,telefone) VALUES($1,'11987654321') RETURNING id", [nome],
  )
  const inicial = await vincularEmpresaTeste(banco, empresaId, dono, 'banco')
  const versao = sucesso(await operacoes.registrarContatoDireto(dono, { empresaId, versao: inicial, chave: randomUUID() }, {
    tipo: 'interessado', nota: 'Contato original', proximoPasso: 'Enviar catálogo', proximoPassoData: '2027-03-02',
  }))
  const [{ id: negociacaoId }] = await banco.sql<{ id: string }>(
    'SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresaId],
  )
  return { empresaId, negociacaoId, nome, versao }
}

type Ciclo = Awaited<ReturnType<typeof abrir>>

async function arquivar(ciclo: Ciclo, dono = vendedor, peloFunil = true) {
  const versao = sucesso(await operacoes.arquivarSemInteresse(dono, { ...ciclo, chave: randomUUID() }, peloFunil ? ciclo.negociacaoId : null))
  return { ...ciclo, versao }
}

const devolver = (ciclo: Ciclo, chave = randomUUID(), dono = vendedor) =>
  operacoes.devolverAoFunil(dono, { ...ciclo, chave }, ciclo.negociacaoId)
const desatualizada = { ok: false, motivo: 'desatualizada' }
const semPermissao = { ok: false, motivo: 'sem_permissao' }

test('lista três arquivos vigentes do Funil do próprio vendedor, por data e ID', async () => {
  const antigos = []
  for (const nome of ['Fora do recorte', 'Terceira', 'Empate A', 'Empate B']) {
    antigos.push(await arquivar(await abrir(nome)))
  }
  for (const [i, ciclo] of antigos.entries()) {
    const em = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-03'][i] + 'T14:00:00.000Z'
    await banco.sql('UPDATE empresa_vinculo SET arquivada_em=$2 WHERE empresa_id=$1', [ciclo.empresaId, em])
  }
  const arquivoOutro = await arquivar(await abrir('Do outro vendedor', outro), outro)
  const arquivoGeral = await arquivar(await abrir('Da ficha'), vendedor, false)
  const aberto = await abrir('Aberta')
  expect(await devolver(arquivoGeral)).toEqual(desatualizada)
  expect(await devolver(arquivoOutro)).toEqual(semPermissao)
  expect(await devolver(aberto)).toEqual(desatualizada)

  const resultado = await consulta.listarSemInteresseFunil(vendedor)
  const empates = antigos.slice(2).sort((a, b) => b.empresaId.localeCompare(a.empresaId))
  expect(resultado).toEqual([...empates, antigos[1]].map(ciclo => ({
    ...ciclo, arquivadaEm: ciclo.nome === 'Terceira' ? '2026-11-02T14:00:00.000Z' : '2026-11-03T14:00:00.000Z',
  })))
  expect(await consulta.listarSemInteresseFunil(outro)).toEqual([expect.objectContaining({ empresaId: arquivoOutro.empresaId })])
  expect(await consulta.listarSemInteresseFunil(gestor)).toEqual([])

  const foraDoRecorte = antigos[0]
  const chave = randomUUID()
  const versao = sucesso(await devolver(foraDoRecorte, chave))
  expect(await devolver(foraDoRecorte, chave)).toEqual({ ok: true, versao, repetida: true })
})

test('reenvios concorrentes devolvem um ciclo novo, preservam o histórico e não restauram agenda', async () => {
  const ciclo = await arquivar(await abrir('Pode voltar'))
  const sqlCiclos = 'SELECT id, vendedor_id, etapa, encerrada_em, encerramento FROM negociacao WHERE empresa_id=$1 ORDER BY encerrada_em NULLS LAST'
  const antigos = await banco.sql(sqlCiclos, [ciclo.empresaId])
  const contatos = await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [ciclo.empresaId])
  const chave = randomUUID()

  const resultados = await Promise.all([devolver(ciclo, chave), devolver(ciclo, chave)])
  expect(resultados).toEqual(expect.arrayContaining([
    { ok: true, versao: ciclo.versao + 2, repetida: false },
    { ok: true, versao: ciclo.versao + 2, repetida: true },
  ]))
  expect(await devolver(ciclo)).toEqual(desatualizada)
  expect(await devolver({ ...ciclo, negociacaoId: randomUUID() }, chave)).toEqual({ ok: false, motivo: 'chave_reutilizada' })
  expect(await devolver(ciclo, chave, outro)).toEqual(semPermissao)
  expect(await devolver(ciclo, chave, gestor)).toEqual(semPermissao)
  const negociacoes = await banco.sql<{ id: string }>(sqlCiclos, [ciclo.empresaId])
  expect(negociacoes).toEqual([...antigos, {
    id: expect.any(String), vendedor_id: vendedor, etapa: 'primeiro_contato', encerrada_em: null, encerramento: null,
  }])
  expect(negociacoes[1].id).not.toBe(ciclo.negociacaoId)
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [ciclo.empresaId])).toEqual(contatos)
  expect(await banco.sql('SELECT arquivada_em,agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [ciclo.empresaId]))
    .toEqual([{ arquivada_em: null, agenda_contato_id: null }])
  expect((await consulta.lerFunil(vendedor)).find(n => n.id === negociacoes[1].id))
    .toMatchObject({ proximoPasso: null, retorno: null })
  expect(await consulta.listarSemInteresseFunil(vendedor))
    .not.toEqual(expect.arrayContaining([expect.objectContaining({ empresaId: ciclo.empresaId })]))

  const novoArquivo = await arquivar({ ...ciclo, negociacaoId: negociacoes[1].id, versao: ciclo.versao + 2 })
  expect(await devolver({ ...novoArquivo, negociacaoId: ciclo.negociacaoId })).toEqual(desatualizada)
  expect(await devolver(ciclo, chave)).toEqual({ ok: true, versao: ciclo.versao + 2, repetida: true })
  expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [ciclo.empresaId])).toEqual([])
})

test('venda e arquivo legado excluem arquivo do Funil mesmo com registro positivo vigente', async () => {
  const abertura = await abrir('Cliente legado')
  await banco.sql('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,1000,$3)',
    [abertura.empresaId, vendedor, randomUUID()])
  const [{ id: aberta }] = await banco.sql<{ id: string }>(
    'INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2) RETURNING id', [abertura.empresaId, vendedor])
  const [{ versao }] = await banco.sql<{ versao: number }>('SELECT versao FROM empresa_vinculo WHERE empresa_id=$1', [abertura.empresaId])
  const cliente = await arquivar({ ...abertura, negociacaoId: aberta, versao })

  const legado = await arquivar(await abrir('Arquivo permanente'))
  await banco.sql("WITH op AS (INSERT INTO arquivo_legado_operacao(manifesto,assinatura,backup_sha256) VALUES('{}',repeat('a',64),repeat('b',64)) RETURNING id) INSERT INTO empresa_arquivo(empresa_id,operacao_id) SELECT $1,id FROM op", [legado.empresaId])

  for (const ciclo of [cliente, legado]) {
    expect(await devolver(ciclo)).toEqual(desatualizada)
    expect(await banco.sql('SELECT id FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [ciclo.empresaId])).toEqual([])
  }
  const resultado = await consulta.listarSemInteresseFunil(vendedor)
  expect(resultado.map(item => item.empresaId)).not.toContain(cliente.empresaId)
  expect(resultado.map(item => item.empresaId)).not.toContain(legado.empresaId)
})

test('cards carregam agenda vigente em lote e não deduzem agenda do histórico', async () => {
  const comAgenda = await abrir('Com agenda')
  const semAgenda = await abrir('Só histórico')
  const indisponivel = await abrir('Agenda indisponível')
  await banco.sql('UPDATE grupo_importacao SET ativo=false WHERE id IN (SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1)', [indisponivel.empresaId])
  await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=NULL WHERE empresa_id=$1', [semAgenda.empresaId])
  const cards = await consulta.lerFunil(vendedor)
  expect(cards.find(n => n.id === comAgenda.negociacaoId)).toMatchObject({ proximoPasso: 'Enviar catálogo', retorno: '2027-03-02' })
  expect(cards.find(n => n.id === semAgenda.negociacaoId)).toMatchObject({ proximoPasso: null, retorno: null })
  expect(cards.find(n => n.id === indisponivel.negociacaoId)).toMatchObject({
    empresa: { situacao: 'indisponivel' }, proximoPasso: null, retorno: null,
  })
})

test('arquivo exige o vínculo atual e uma procedência positiva na versão atual', async () => {
  const transferida = await arquivar(await abrir('Fila incompatível'))
  await banco.sql('UPDATE empresa_fila SET vendedor_id=$2 WHERE empresa_id=$1', [transferida.empresaId, outro])
  expect(await devolver(transferida)).toEqual(desatualizada)

  const arquivada = await arquivar(await abrir('Novo arquivo geral'))
  const versao = sucesso(await operacoes.retomarAtendimento(vendedor, { ...arquivada, chave: randomUUID() }))
  const arquivoGeral = await arquivar({ ...arquivada, versao }, vendedor, false)
  expect(await devolver(arquivoGeral)).toEqual(desatualizada)
  const recentes = await consulta.listarSemInteresseFunil(vendedor)
  expect(recentes.map(item => item.empresaId)).not.toContain(transferida.empresaId)
  expect(recentes.map(item => item.empresaId)).not.toContain(arquivoGeral.empresaId)
})

test('funções internas do arquivo e executor genérico ficam privados', async () => {
  const { linhas } = await banco.comoUsuario(vendedor, sql => sql(`SELECT
    has_function_privilege('public.atendimento_executar(uuid,uuid,integer,text,jsonb)','EXECUTE') AS executor,
    has_function_privilege('public.funil_arquivo_negociacao(public.empresa_vinculo)','EXECUTE') AS procedencia,
    has_function_privilege('app_conexao','public.funil_sem_interesse_recentes()','EXECUTE') AS leitura_direta,
    has_function_privilege('app_conexao','public.funil_empresa_devolver(uuid,uuid,integer,uuid)','EXECUTE') AS comando_direto`))
  expect(linhas).toEqual([{ executor: false, procedencia: false, leitura_direta: false, comando_direto: false }])
})
