import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { comAdmin } from '@/src/server/db/admin'

let banco: BancoDeTeste
let eu: string
let outro: string
let seq = 0
const registrar = (id: string, usuario = eu) => banco.comoUsuario(usuario, e => e('SELECT empresa_recente_registrar($1::uuid) AS registrado', [id]))
const recentes = (usuario = eu) => banco.comoUsuario(usuario, e => e<{ id: string; disponibilidade: string }>('SELECT * FROM empresa_recentes()'))
async function empresa() {
  return (await banco.sql<{ id: string }>('INSERT INTO empresa(cnpj,razao_social,telefone,email) VALUES ($1,\'Empresa\',\'11999999999\',\'privado@teste.local\') RETURNING id', [String(++seq).padStart(14, '0')]))[0].id
}
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  eu = await criarUsuario(banco, 'vendedor', 'RecenteEu')
  outro = await criarUsuario(banco, 'vendedor', 'RecenteOutro')
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})
test('primeiro acesso, repetição sobe sem duplicar e identidade separada', async () => {
  const a = await empresa(), b = await empresa()
  expect((await registrar(a)).linhas).toEqual([{ registrado: true }])
  await registrar(b)
  await registrar(a)
  expect((await recentes()).linhas.map(x => x.id)).toEqual([a, b])
  expect((await recentes(outro)).linhas).toEqual([])
})
test('limita a dez inclusive em conexões concorrentes', async () => {
  const ids = []
  for (let i = 0; i < 15; i++) ids.push(await empresa())
  await Promise.all(ids.map(id => registrar(id)))
  expect((await recentes()).linhas).toHaveLength(10)
  expect((await banco.sql<{ n: number }>('SELECT count(*)::int AS n FROM empresa_recente'))[0].n).toBe(10)
})
test('perfil e recentes usam estado atual e projeção de oito campos sem reservar', async () => {
  const id = await empresa()
  await registrar(id)
  await banco.sql('INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES ($1,$2,now()+interval \'1 hour\')', [id, outro])
  const { linhas } = await banco.comoUsuario(eu, e => e('SELECT * FROM empresa_perfil($1)', [id]))
  expect(Object.keys(linhas[0]).sort()).toEqual(['id','razao_social','nome_fantasia','cnae_principal','cidade','uf','bairro','disponibilidade'].sort())
  expect(linhas[0]).toEqual((await recentes()).linhas[0])
  expect(linhas[0].disponibilidade).toBe('outro_vendedor')
  expect((await banco.comoUsuario(eu, e => e('SELECT * FROM empresa WHERE id=$1', [id]))).linhas).toEqual([])
})
test('sugestões são somente disponíveis e limitadas', async () => {
  for (let i = 0; i < 12; i++) await empresa()
  const indisponivel = await empresa()
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [indisponivel, outro])
  const { linhas } = await banco.comoUsuario(eu, e => e('SELECT * FROM empresa_sugestoes()'))
  expect(linhas).toHaveLength(10)
  expect(linhas.every(x => x.disponibilidade === 'disponivel')).toBe(true)
})
test('contato atualiza pelo autor e rollback não deixa recente', async () => {
  const id = await empresa()
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [id, eu])
  await expect(banco.comoUsuario(eu, async e => {
    await e("SELECT contato_registrar($1,'ligacao',NULL,NULL,NULL,'nenhum')", [id])
    throw new Error('rollback')
  })).rejects.toThrow('rollback')
  expect((await recentes()).linhas).toEqual([])
  await banco.comoUsuario(eu, e => e("SELECT contato_registrar($1,'ligacao',NULL,NULL,NULL,'nenhum')", [id]))
  expect((await recentes()).linhas.map(x => x.id)).toEqual([id])
  expect((await recentes(outro)).linhas).toEqual([])
})
test('inexistente não registra e leitura pendente não permite gravar', async () => {
  const id = '00000000-0000-0000-0000-000000000000'
  expect((await registrar(id)).linhas).toEqual([{ registrado: false }])
  expect((await banco.comoUsuario(eu, e => e('SELECT * FROM empresa_perfil($1)', [id]))).linhas).toEqual([])
  const pendente = await criarUsuario(banco, 'vendedor', 'RecentePendente')
  await banco.sql('UPDATE usuario SET senha_provisoria_pendente=true WHERE id=$1', [pendente])
  expect((await recentes(pendente)).linhas).toEqual([])
  await expect(registrar(await empresa(), pendente)).rejects.toMatchObject({ code: '42501' })
})
test('sem identidade, escrita direta e funções internas são negadas', async () => {
  const id = await empresa()
  await expect(banco.sql('SELECT * FROM empresa_recentes()')).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(eu, e => e('INSERT INTO empresa_recente(usuario_id,empresa_id,acessada_em) VALUES ($1,$2,now())', [eu,id]))).rejects.toMatchObject({ code: '42501' })
  await expect(banco.comoUsuario(eu, e => e('SELECT empresa_recente_gravar($1,$2)', [outro,id]))).rejects.toMatchObject({ code: '42501' })
  const acl = await banco.sql("SELECT has_function_privilege('app_conferencia','empresa_recentes()','EXECUTE') AS permitido")
  expect(acl).toEqual([{ permitido: false }])
})
test('repositório mapeia resumo e traduz somente permissão', async () => {
  const { listarRecentes, listarSugestoes, lerPerfil, registrarRecente } = await import('@/src/features/prospeccao/recentes')
  const id = await empresa()
  expect(await registrarRecente(eu,id)).toEqual({ ok: true, registrado: true })
  expect(await lerPerfil(eu,id)).toMatchObject({ ok: true, empresa: { id, razaoSocial: 'Empresa' } })
  expect(await listarRecentes(eu)).toMatchObject({ ok: true, empresas: [{ id }] })
  expect(await listarSugestoes(eu)).toMatchObject({ ok: true, empresas: [{ id }] })
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [outro])
  expect(await listarRecentes(outro)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await lerPerfil(outro,id)).toEqual({ ok: false, motivo: 'sem_permissao' })
  expect(await registrarRecente(outro,id)).toEqual({ ok: false, motivo: 'sem_permissao' })
})

async function esperarAdvisoryPendente() {
  for (let i = 0; i < 100; i++) {
    const [{ n }] = await banco.sql<{ n: number }>(`SELECT count(*)::int AS n FROM pg_locks
      WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`)
    if (n > 0) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('operação não aguardou advisory')
}

test('visita aguarda contato antes da FK e não forma ciclo de locks', async () => {
  const id = await empresa()
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [id,eu])
  let liberar!: () => void
  let bloqueou!: () => void
  const pronto = new Promise<void>(r => { bloqueou = r })
  const continuar = new Promise<void>(r => { liberar = r })
  const contato = comAdmin(banco.urlAdmin, async c => {
    await c.query('BEGIN')
    try {
      await c.query("SELECT set_config('app.usuario_id',$1,true)", [eu])
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,25))', [eu])
      await c.query('SELECT id FROM empresa WHERE id=$1 FOR UPDATE', [id])
      bloqueou()
      await continuar
      await c.query("SELECT contato_registrar($1,'ligacao',NULL,NULL,NULL,'nenhum')", [id])
      await c.query('COMMIT')
    } catch (erro) {
      await c.query('ROLLBACK')
      throw erro
    }
  })
  await pronto
  const visita = registrar(id)
  try {
    await esperarAdvisoryPendente()
  } finally {
    liberar()
  }
  await Promise.all([contato,visita])
  expect((await recentes()).linhas.map(r => r.id)).toEqual([id])
})

test('revalida permissão após esperar advisory', async () => {
  const id = await empresa()
  const usuario = await criarUsuario(banco,'vendedor','RecenteRevogado')
  let liberar!: () => void
  let bloqueou!: () => void
  const pronto = new Promise<void>(r => { bloqueou = r })
  const continuar = new Promise<void>(r => { liberar = r })
  const bloqueador = banco.comoUsuario(usuario, async e => {
    await e('SELECT pg_advisory_xact_lock(hashtextextended($1,25))', [usuario])
    bloqueou()
    await continuar
  })
  await pronto
  const visita = registrar(id,usuario)
  const negada = expect(visita).rejects.toMatchObject({ code:'42501' })
  try {
    await esperarAdvisoryPendente()
    await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [usuario])
  } finally {
    liberar()
  }
  await Promise.all([bloqueador,negada])
  expect(await banco.sql('SELECT 1 FROM empresa_recente WHERE usuario_id=$1', [usuario])).toEqual([])
})
