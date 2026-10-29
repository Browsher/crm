import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { lerMigracoes, PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string, a: string, b: string
let ids: string[]
let antes: unknown[]
let somas: unknown[]
const tabelasPreservadas = ['empresa', 'empresa_fila', 'contato', 'negociacao', 'venda', 'busca_empresa', 'grupo_importacao', 'grupo_importacao_empresa', 'google_planejamento', 'google_exclusividade']
async function retrato() {
  const linhas: unknown[] = []
  for (const tabela of tabelasPreservadas) linhas.push(await banco.sql(`SELECT to_jsonb(t) AS dado FROM ${tabela} t ORDER BY to_jsonb(t)::text`))
  return linhas
}

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  // Reconstitui o estado da 0049 num banco exclusivo, sem modificar migração antiga.
  const pasta = await mkdtemp(join(tmpdir(), 'crm-atendimento-'))
  const antigo = await criarBancoDeTeste({ semMigracoes: true })
  try {
    for (const m of (await lerMigracoes(PASTA_MIGRACOES)).filter(m => m.nome < '0050')) {
      await copyFile(join(PASTA_MIGRACOES, m.nome), join(pasta, m.nome))
    }
    expect((await aplicar(antigo.urlAdmin, pasta)).ok).toBe(true)
    await banco.derrubar()
    banco = antigo
    process.env.DATABASE_URL = banco.urlApp
  } catch (erro) {
    await antigo.derrubar()
    throw erro
  } finally { await rm(pasta, { recursive: true, force: true }) }
  a = await criarUsuario(banco, 'vendedor', 'TransicaoA')
  b = await criarUsuario(banco, 'vendedor', 'TransicaoB')
  gestor = await criarUsuario(banco, 'gestor', 'TransicaoGestor')
  ids = []
  for (let i = 0; i < 9; i++) {
    const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES($1,'11987654321') RETURNING id", [`Legada ${i}`])
    ids.push(id)
  }
  // 0: cliente; 1: último contato sem tarefa; 2: arquivo inequívoco;
  // 3: conflito Google; 4: inativo; 5: só autoria; 6: sem evidência;
  // 7: Sem interesse antigo contradito por venda; 8: descanso de Não atendeu.
  for (const i of [0, 1, 2, 3, 7, 8]) await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [ids[i], a])
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [ids[4], b])
  await banco.sql("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-29','Luz','','São Paulo','SP')", [b])
  await banco.sql('INSERT INTO google_exclusividade(empresa_id,vendedor_id,planejamento_id) SELECT $1,$2,id FROM google_planejamento WHERE vendedor_id=$2', [ids[3], b])
  await banco.sql('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
  try {
    for (const i of [0, 1, 2, 5, 7, 8]) {
      await banco.sql(`INSERT INTO contato(empresa_id,tipo,criado_por,criado_em,proximo_passo,proximo_passo_data)
        VALUES($1,$2,$3,'2026-10-01','Tarefa histórica','2026-10-02')`, [ids[i], [2, 5, 7].includes(i) ? 'sem_interesse' : 'nao_atendeu', a])
    }
    await banco.sql("INSERT INTO contato(empresa_id,tipo,criado_por,criado_em) VALUES($1,'acompanhamento',$2,'2026-10-03')", [ids[1], a])
  } finally { await banco.sql('ALTER TABLE contato ENABLE TRIGGER contato_auditoria') }
  for (const i of [0, 7]) await banco.sql("INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave) VALUES($1,$2,CURRENT_DATE,1000,gen_random_uuid())", [ids[i], a])
  await banco.sql("INSERT INTO negociacao(empresa_id,vendedor_id,iniciada_em,encerrada_em,encerramento) VALUES($1,$2,'2026-09-01','2026-09-30','devolucao')", [ids[5], a])
  const [{ id: grupo }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('Grupo anterior à transição') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo, ids[0]])
  await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,concluido_em) VALUES($1,'Busca anterior','{}',1,'concluida',$2,now())", [a, grupo])
  await banco.sql("UPDATE empresa_fila SET elegivel_em=now()+interval '30 days' WHERE empresa_id=$1", [ids[8]])
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [b])
  antes = await retrato()
  somas = await banco.sql('SELECT nome,soma FROM _migracao ORDER BY nome')
  expect((await aplicar(banco.urlAdmin, PASTA_MIGRACOES)).ok).toBe(true)
})
afterAll(async () => { await banco?.derrubar() })

test('migração mantém todos os IDs, autoria, vendas, grupos e somas anteriores', async () => {
  expect(await retrato()).toEqual(antes)
  expect(await banco.sql("SELECT nome,soma FROM _migracao WHERE nome<'0050' ORDER BY nome")).toEqual(somas)
  expect(await banco.sql('SELECT empresa_id FROM empresa_vinculo')).toHaveLength(4)
  expect(await banco.sql('SELECT empresa_id FROM empresa_vinculo_pendencia')).toHaveLength(5)
  expect(await banco.sql('SELECT * FROM empresa_atendimento_operacao')).toEqual([])
})

test('agenda usa só último contato e descanso não equivale a Sem interesse', async () => {
  const r = await banco.sql<{ empresa_id: string; agenda_contato_id: string | null; arquivada_em: Date | null }>('SELECT empresa_id,agenda_contato_id,arquivada_em FROM empresa_vinculo')
  expect(r.find(v => v.empresa_id === ids[0])?.agenda_contato_id).toBeTruthy()
  expect(r.find(v => v.empresa_id === ids[1])).toMatchObject({ agenda_contato_id: null, arquivada_em: null })
  expect(r.find(v => v.empresa_id === ids[2])).toMatchObject({ agenda_contato_id: null, arquivada_em: expect.any(Date) })
  expect(r.find(v => v.empresa_id === ids[8])).toMatchObject({ arquivada_em: null, agenda_contato_id: expect.any(String) })
  expect(await banco.sql('SELECT motivo FROM empresa_vinculo_pendencia WHERE empresa_id=$1', [ids[7]])).toEqual([{ motivo: 'sem_interesse_contraditorio' }])
  expect(await banco.sql('SELECT motivo FROM empresa_vinculo_pendencia WHERE empresa_id=$1', [ids[5]])).toEqual([{ motivo: 'sem_evidencia' }])
})

test('inventário é do gestor real, paginado e somente leitura, sem contatos no JSON', async () => {
  const { inventariarTransicao } = await import('@/src/server/atendimento/transicao')
  const novas = ['empresa_vinculo', 'empresa_vinculo_pendencia', 'empresa_atendimento_operacao']
  const snapshot = []
  for (const tabela of novas) snapshot.push(await banco.sql(`SELECT to_jsonb(t) AS dado FROM ${tabela} t ORDER BY empresa_id`))
  expect(await inventariarTransicao(a, null, 100)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await inventariarTransicao(gestor, 'invalido', 100)).toEqual({ ok: false, motivo: 'filtros_invalidos' })
  expect(await inventariarTransicao(gestor, null, 101)).toEqual({ ok: false, motivo: 'filtros_invalidos' })
  const primeira = await inventariarTransicao(gestor, null, 2)
  expect(primeira).toMatchObject({ ok: true, dados: { totais: { empresas: 9, vinculosInequivocos: 4, pendencias: 5 } } })
  if (!primeira.ok) throw new Error('inventário recusou gestor')
  expect(primeira.dados.pendencias).toHaveLength(2)
  const segunda = await inventariarTransicao(gestor, primeira.dados.proximo, 100)
  if (!segunda.ok) throw new Error('inventário recusou segunda página')
  expect(segunda.dados.pendencias).toHaveLength(3)
  expect(segunda.dados.proximo).toBeNull()
  expect(new Set([...primeira.dados.pendencias, ...segunda.dados.pendencias].map(p => p.empresaId)).size).toBe(5)
  expect(JSON.stringify(primeira)).not.toMatch(/119876|Tarefa|proximo_passo|nota|telefone/)
  for (const [i, tabela] of novas.entries()) expect(await banco.sql(`SELECT to_jsonb(t) AS dado FROM ${tabela} t ORDER BY empresa_id`)).toEqual(snapshot[i])
  expect(await retrato()).toEqual(antes)
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [gestor])
  expect(await inventariarTransicao(gestor, null, 100)).toEqual({ ok: false, motivo: 'sem_permissao' })
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [gestor])
})

test('CLI local lê usando identidade de gestor, valida argumentos e recusa host remoto', async () => {
  const executar = (args: string[], url = banco.urlApp) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/atendimento/inventariar.mts', ...args], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, DATABASE_URL: url },
  })
  const ok = executar(['--gestor', gestor, '--limite', '2'])
  expect(ok.status, ok.stderr).toBe(0)
  expect(JSON.parse(ok.stdout)).toMatchObject({ ok: true, dados: { totais: { empresas: 9 } } })
  for (const args of [['--gestor', a, '--limite', '2'], ['--gestor', gestor, '--limite', '101'], ['--gestor', 'invalido', '--limite', '2']]) {
    expect(executar(args).status).not.toBe(0)
  }
  const remoto = new URL(banco.urlApp)
  remoto.hostname = 'example.invalid'
  const recusado = executar(['--gestor', gestor, '--limite', '2'], remoto.toString())
  expect(recusado.status).not.toBe(0)
  expect(recusado.stdout + recusado.stderr).not.toMatch(/postgres:|app_teste:|teste@|INSERT|UPDATE|DELETE/)
})

test('classificação SQL concorda com a regra pura em reservas e entregas de fontes recuperáveis', async () => {
  const { classificarVinculoLegado } = await import('@/src/server/atendimento/transicao')
  const outroAtivo = await criarUsuario(banco, 'vendedor', 'RecuperavelAtivo')
  const empresas: string[] = []
  for (let i = 0; i < 6; i++) {
    const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES($1,'11987654321') RETURNING id", [`Recuperável ${i}`])
    empresas.push(id)
  }
  // Uma reserva expirada ainda documenta quem recebeu. Inatividade não elimina candidato.
  await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()-interval '1 day')", [empresas[0], a])
  for (const [indice, vendedor] of [[1, a], [2, a], [2, outroAtivo], [3, a], [3, b], [4, b]] as const) {
    const [{ id: grupo }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('Entrega recuperável') RETURNING id")
    await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo, empresas[indice]])
    await banco.sql("INSERT INTO busca_empresa(usuario_id,nome,filtros,quantidade,estado,grupo_id,concluido_em) VALUES($1,'Histórica','{}',1,'concluida',$2,now())", [vendedor, grupo])
  }
  // Responsável atual prevalece sobre uma entrega antiga incompatível, sem Google.
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresas[4], a])
  await banco.sql("INSERT INTO google_planejamento(vendedor_id,dia,nicho,bairro,cidade,uf) VALUES($1,'2026-10-29','Luz','','São Paulo','SP')", [a])
  await banco.sql('INSERT INTO google_exclusividade(empresa_id,vendedor_id,planejamento_id) SELECT $1,$2,id FROM google_planejamento WHERE vendedor_id=$2', [empresas[5], a])
  const linhas = await banco.sql<{ responsavel: string | null; google: string | null; candidatos: string[]; motivo_vinculo: string | null; vendedor_id: string | null }>(
    'SELECT responsavel,google,candidatos,motivo_vinculo,vendedor_id FROM empresa_transicao_evidencias WHERE empresa_id=ANY($1)', [empresas],
  )
  expect(linhas).toHaveLength(6)
  for (const linha of linhas) {
    const decisao = classificarVinculoLegado({ ...linha, ativos: [a, outroAtivo] })
    if (decisao.tipo === 'pendente') expect(linha.motivo_vinculo).toBe(decisao.motivo)
    else { expect(linha.motivo_vinculo).toBeNull(); expect(linha.vendedor_id).toBe(decisao.vendedorId) }
  }
})
