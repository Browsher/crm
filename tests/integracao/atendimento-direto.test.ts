import { vincularGrupoAtivo } from './grupos-fixtures'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { iniciarAtendimento, registrarContatoDireto, arquivarSemInteresse, retomarAtendimento } from '@/src/server/atendimento/operacoes'

let banco: BancoDeTeste
let vendedor: string
let outro: string
let gestor: string
let empresa: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Direto')
  outro = await criarUsuario(banco, 'vendedor', 'OutroDireto')
  gestor = await criarUsuario(banco, 'gestor', 'GestorDireto')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  const [e] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Atendimento','11987654321') RETURNING id")
  empresa = e.id
  await vincularGrupoAtivo(banco,[empresa])
  await banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial,recebida_em) VALUES($1,$2,'banco',now()-interval '90 days')", [empresa, vendedor])
})
async function rpc(nome: string, args: unknown[], usuario = vendedor) {
  return banco.comoUsuario(usuario, async e => (await e<{ r: { ok: boolean; motivo?: string; versao: number; repetida: boolean } }>(`SELECT ${nome}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS r`, args)).linhas[0].r)
}
const contato = (empresa: string, versao: number, tipo: string, passo: string | null = null, data: string | null = null, chave = randomUUID()) =>
  rpc('contato_registrar_direto', [empresa, chave, versao, tipo, null, passo, data])

test('iniciar só marca início e mantém vínculo permanente sem responsabilidade comercial', async () => {
  const r = await rpc('atendimento_iniciar', [empresa, randomUUID(), 1])
  expect(r).toEqual({ ok: true, versao: 2, repetida: false })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1', [empresa])).toHaveLength(0)
  expect(await banco.sql('SELECT * FROM empresa_fila WHERE empresa_id=$1', [empresa])).toHaveLength(0)
  expect((await banco.sql('SELECT iniciada_em FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toMatchObject({ iniciada_em: expect.any(Date) })
})
test('não atendeu com ou sem próximo passo nunca abre negociação; contato e agenda são atômicos', async () => {
  expect(await contato(empresa, 1, 'nao_atendeu', 'Ligar', '2027-03-02')).toMatchObject({ ok: true })
  const [v] = await banco.sql<{ versao: number; agenda_contato_id: string }>('SELECT * FROM empresa_vinculo WHERE empresa_id=$1', [empresa])
  expect(v.agenda_contato_id).toBeTruthy()
  expect(await contato(empresa, v.versao, 'nao_atendeu')).toMatchObject({ ok: true })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1', [empresa])).toHaveLength(0)
  expect((await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toEqual({ agenda_contato_id: null })
})
test('replay precede versão, não duplica contato e recusa dados divergentes', async () => {
  const chave = randomUUID()
  const r = await contato(empresa, 1, 'nao_atendeu', null, null, chave)
  expect(r).toMatchObject({ ok: true, repetida: false })
  expect(await contato(empresa, 1, 'nao_atendeu', null, null, chave)).toEqual({ ...r, repetida: true })
  expect(await contato(empresa, 1, 'interessado', null, null, chave)).toEqual({ ok: false, motivo: 'chave_reutilizada' })
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toHaveLength(1)
  expect(await contato(empresa, 1, 'nao_atendeu')).toEqual({ ok: false, motivo: 'desatualizada' })
})
test('validação do banco exige par e retorno combinado e impede acompanhamento inicial', async () => {
  for (const args of [['nao_atendeu', 'Ligar', null], ['nao_atendeu', 'Ligar', '2027-02-30'], ['retornar_depois', null, null], ['sem_interesse', 'Ligar', '2027-03-02'], ['acompanhamento', 'Ligar', '2027-03-02']]) {
    expect(await contato(empresa, 1, args[0]!, args[1], args[2])).toEqual({ ok: false, motivo: 'dados_invalidos' })
  }
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toEqual([])
})
test('interesse e retorno assumem e abrem apenas uma negociação', async () => {
  const r = await contato(empresa, 1, 'interessado')
  expect(r.ok).toBe(true)
  expect(await contato(empresa, r.versao, 'retornar_depois', 'Ligar', '2027-03-02')).toMatchObject({ ok: true })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1 AND encerrada_em IS NULL', [empresa])).toHaveLength(1)
  expect((await banco.sql('SELECT vendedor_id FROM empresa_fila WHERE empresa_id=$1', [empresa]))[0]).toEqual({ vendedor_id: vendedor })
})
test('permissão precede replay, gestor não ganha comandos e vínculo de outro é privado', async () => {
  const chave = randomUUID()
  expect(await rpc('atendimento_iniciar', [empresa, chave, 1])).toMatchObject({ ok: true })
  for (const usuario of [outro, gestor]) expect(await rpc('atendimento_iniciar', [empresa, chave, 1], usuario)).toEqual({ ok: false, motivo: 'sem_permissao' })
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  expect(await rpc('atendimento_iniciar', [empresa, chave, 1])).toEqual({ ok: false, motivo: 'sem_permissao' })
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [vendedor])
})
test('leitura permanente de empresa, contato e dados cadastrais é restrita ao vínculo', async () => {
  await banco.sql("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [empresa])
  await banco.sql("INSERT INTO empresa_dados_cadastrais(empresa_id,fonte,coletado_em,telefones) VALUES($1,'CNPJ.biz',now(),'[]')", [empresa])
  for (const tabela of ['empresa', 'contato', 'empresa_dados_cadastrais']) {
    const coluna = tabela === 'empresa' ? 'id' : 'empresa_id'
    for (const usuario of [vendedor, outro, gestor]) {
      const linhas = await banco.comoUsuario(usuario, e => e(`SELECT * FROM ${tabela} WHERE ${coluna}=$1`, [empresa]))
      expect(linhas.linhas).toHaveLength(usuario === outro ? 0 : 1)
    }
  }
})
test('duas chamadas simultâneas com mesma chave produzem um contato', async () => {
  const chave = randomUUID()
  const resultados = await Promise.all([contato(empresa, 1, 'nao_atendeu', null, null, chave), contato(empresa, 1, 'nao_atendeu', null, null, chave)])
  expect(resultados.every(r => r.ok)).toBe(true)
  expect(resultados.filter(r => r.repetida)).toHaveLength(1)
  expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toHaveLength(1)
})

test('adaptadores reais passam identidade, versão, chave e dados sem perder o resultado do banco', async () => {
  const inicio = await iniciarAtendimento(vendedor, { empresaId: empresa, chave: randomUUID(), versao: 1 })
  expect(inicio).toEqual({ ok: true, versao: 2, repetida: false })
  if (!inicio.ok) throw new Error('início recusado')
  const contato = await registrarContatoDireto(vendedor, { empresaId: empresa, chave: randomUUID(), versao: inicio.versao }, { tipo: 'nao_atendeu', nota: ' Tentativa ', proximoPasso: ' Ligar ', proximoPassoData: '2027-03-02' })
  expect(contato.ok).toBe(true)
  if (!contato.ok) throw new Error('contato recusado')
  const arquivo = await arquivarSemInteresse(vendedor, { empresaId: empresa, chave: randomUUID(), versao: contato.versao }, null)
  expect(arquivo.ok).toBe(true)
  if (!arquivo.ok) throw new Error('arquivo recusado')
  expect(await retomarAtendimento(vendedor, { empresaId: empresa, chave: randomUUID(), versao: arquivo.versao })).toMatchObject({ ok: true })
  expect(await banco.sql('SELECT nota,proximo_passo,criado_por FROM contato WHERE empresa_id=$1', [empresa])).toEqual([{ nota: 'Tentativa', proximo_passo: 'Ligar', criado_por: vendedor }])
})

test('revalida permissão depois de aguardar advisory e não grava operação nem contato', async () => {
  const trava = new Client({ connectionString: banco.urlAdmin })
  await trava.connect()
  let resultado: ReturnType<typeof contato> | undefined
  try {
    await trava.query('BEGIN')
    await trava.query('SELECT pg_advisory_xact_lock(hashtextextended($1,25))', [vendedor])
    resultado = contato(empresa, 1, 'nao_atendeu')
    await expect.poll(async () => (await banco.sql<{ aguardando: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT contato_registrar_direto%') AS aguardando"))[0].aguardando).toBe(true)
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [vendedor])
    await trava.query('COMMIT')
    expect(await resultado).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toEqual([])
    expect(await banco.sql('SELECT * FROM empresa_atendimento_operacao WHERE empresa_id=$1', [empresa])).toEqual([])
  } finally {
    await trava.query('ROLLBACK')
    await trava.end()
    await resultado
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente=false WHERE id=$1', [vendedor])
  }
})

test('revalida vínculo depois de aguardar empresa, sem vazar replay do dono anterior', async () => {
  const chave = randomUUID()
  expect(await rpc('atendimento_iniciar', [empresa, chave, 1])).toMatchObject({ ok: true })
  const trava = new Client({ connectionString: banco.urlAdmin })
  await trava.connect()
  let resultado: ReturnType<typeof rpc> | undefined
  try {
    await trava.query('BEGIN')
    await trava.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE', [empresa])
    resultado = rpc('atendimento_iniciar', [empresa, chave, 1])
    await expect.poll(async () => (await banco.sql<{ aguardando: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT atendimento_iniciar%') AS aguardando"))[0].aguardando).toBe(true)
    await trava.query('UPDATE empresa_vinculo SET vendedor_id=$2 WHERE empresa_id=$1', [empresa, outro])
    await trava.query('COMMIT')
    expect(await resultado).toEqual({ ok: false, motivo: 'sem_permissao' })
  } finally {
    await trava.query('ROLLBACK')
    await trava.end()
    await resultado
  }
})

test('helpers internos não são concedidos ao aplicativo', async () => {
  await expect(banco.comoUsuario(vendedor, e => e('SELECT atendimento_arquivar_interno($1)', [empresa]))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(vendedor, e => e("SELECT atendimento_executar($1,$2,1,'iniciar','{}')", [empresa, randomUUID()]))).rejects.toMatchObject({ code: '42501' })
})

test('vendedor inativo não lê empresa nem contato pela responsabilidade comercial legada', async () => {
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresa, vendedor])
  await banco.sql("INSERT INTO contato(empresa_id,tipo) VALUES($1,'nao_atendeu')", [empresa])
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  try {
    const linhas = await banco.comoUsuario(vendedor, async e => ({ empresas: (await e('SELECT id FROM empresa WHERE id=$1', [empresa])).linhas, contatos: (await e('SELECT id FROM contato WHERE empresa_id=$1', [empresa])).linhas }))
    expect(linhas).toEqual({ empresas: [], contatos: [] })
  } finally { await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [vendedor]) }
})

test('falha ao salvar resultado reverte contato, agenda e versão na mesma transação', async () => {
  await banco.sql("CREATE FUNCTION teste_operacao_falhar() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha controlada' USING ERRCODE='P0001'; END; $$")
  await banco.sql('CREATE TRIGGER teste_operacao_falhar BEFORE INSERT ON empresa_atendimento_operacao FOR EACH ROW EXECUTE FUNCTION teste_operacao_falhar()')
  const antes = await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1', [empresa])
  try {
    await expect(contato(empresa, 1, 'retornar_depois', 'Ligar', '2027-03-02')).rejects.toMatchObject({ code: 'P0001' })
    expect(await banco.sql('SELECT * FROM empresa_vinculo WHERE empresa_id=$1', [empresa])).toEqual(antes)
    expect(await banco.sql('SELECT * FROM contato WHERE empresa_id=$1', [empresa])).toEqual([])
    expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1', [empresa])).toEqual([])
    expect(await banco.sql('SELECT * FROM empresa_fila WHERE empresa_id=$1', [empresa])).toEqual([])
  } finally {
    await banco.sql('DROP TRIGGER teste_operacao_falhar ON empresa_atendimento_operacao')
    await banco.sql('DROP FUNCTION teste_operacao_falhar()')
  }
})

test('não liguei preserva nota e autoria sem assumir, devolver ou inventar agenda e tem replay único', async () => {
  const chave = randomUUID()
  const comando = { empresaId: empresa, chave, versao: 1 }
  const entrada = { tipo: 'nao_liguei' as const, nota: ' Cadastro fora do perfil ', proximoPasso: null, proximoPassoData: null }
  const r = await registrarContatoDireto(vendedor, comando, entrada)
  expect(r).toMatchObject({ ok: true, repetida: false })
  expect(await registrarContatoDireto(vendedor, comando, entrada)).toEqual({ ...r, repetida: true })
  expect(await banco.sql('SELECT tipo,nota,criado_por,proximo_passo,proximo_passo_data FROM contato WHERE empresa_id=$1', [empresa])).toEqual([{ tipo: 'nao_liguei', nota: 'Cadastro fora do perfil', criado_por: vendedor, proximo_passo: null, proximo_passo_data: null }])
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1', [empresa])).toEqual([])
  expect(await banco.sql('SELECT * FROM empresa_fila WHERE empresa_id=$1', [empresa])).toEqual([])
  expect((await banco.sql('SELECT vendedor_id,arquivada_em,agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toEqual({ vendedor_id: vendedor, arquivada_em: null, agenda_contato_id: null })
  if (!r.ok) throw new Error('atividade recusada')
  expect(await registrarContatoDireto(vendedor, { empresaId: empresa, chave: randomUUID(), versao: r.versao }, { ...entrada, proximoPasso: 'Tentar amanhã', proximoPassoData: '2027-03-02' })).toMatchObject({ ok: true })
  expect((await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [empresa]))[0]).toMatchObject({ agenda_contato_id: expect.any(String) })
  expect(await banco.sql('SELECT * FROM negociacao WHERE empresa_id=$1', [empresa])).toEqual([])
})
