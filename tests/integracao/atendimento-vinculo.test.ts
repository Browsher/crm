import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento } from './atendimento-fixtures'
import { comAdmin } from '@/src/server/db/admin'

let banco: BancoDeTeste
let c: Awaited<ReturnType<typeof cenarioAtendimento>>
beforeAll(async () => { banco = await criarBancoDeTeste(); c = await cenarioAtendimento(banco) })
afterAll(async () => { await banco?.derrubar() })

test('dono lê vínculo, empresa e contato; vendedor alheio não lê nenhum deles', async () => {
  await banco.sql("INSERT INTO contato(empresa_id,tipo,nota) VALUES($1,'nao_atendeu','Histórico preservado')", [c.empresaId])
  for (const tabela of ['empresa_vinculo', 'empresa', 'contato']) {
    const coluna = tabela === 'empresa' ? 'id' : 'empresa_id'
    expect((await banco.comoUsuario(c.vendedorId, e => e(`SELECT * FROM ${tabela} WHERE ${coluna}=$1`, [c.empresaId]))).linhas).toHaveLength(1)
    expect((await banco.comoUsuario(c.outroId, e => e(`SELECT * FROM ${tabela} WHERE ${coluna}=$1`, [c.empresaId]))).linhas).toEqual([])
  }
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [c.vendedorId])
  expect((await banco.comoUsuario(c.vendedorId, e => e('SELECT * FROM empresa_vinculo'))).linhas).toEqual([])
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [c.vendedorId])
})

test('nem vendedor nem gestor escrevem diretamente nas três tabelas novas', async () => {
  for (const ator of [c.vendedorId, c.gestorId]) {
    for (const tabela of ['empresa_vinculo', 'empresa_vinculo_pendencia', 'empresa_atendimento_operacao']) {
      await expect(banco.comoUsuario(ator, e => e(`DELETE FROM ${tabela}`))).rejects.toMatchObject({ code: '42501' })
      await expect(banco.comoUsuario(ator, e => e(`UPDATE ${tabela} SET empresa_id=empresa_id`))).rejects.toMatchObject({ code: '42501' })
      await expect(banco.comoUsuario(ator, e => e(`INSERT INTO ${tabela}(empresa_id) VALUES($1)`, [c.empresaId]))).rejects.toMatchObject({ code: '42501' })
    }
  }
})

test('só gestor lê pendências; operação de outro autor não é exposta ao vendedor', async () => {
  await banco.sql("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,evidencias) VALUES($1,'sem_evidencia','{}')", [c.empresaId])
  await banco.sql("INSERT INTO empresa_atendimento_operacao(chave,usuario_id,empresa_id,operacao,entrada,resultado) VALUES(gen_random_uuid(),$1,$2,'teste','{}','{}')", [c.outroId, c.empresaId])
  for (const tabela of ['empresa_vinculo_pendencia', 'empresa_atendimento_operacao']) {
    expect((await banco.comoUsuario(c.gestorId, e => e(`SELECT * FROM ${tabela}`))).linhas).toHaveLength(1)
    expect((await banco.comoUsuario(c.vendedorId, e => e(`SELECT * FROM ${tabela}`))).linhas).toEqual([])
    expect((await banco.comoUsuario(c.outroId, e => e(`SELECT * FROM ${tabela}`))).linhas).toEqual([])
  }
})

test('mudança concorrente na tarefa não deixa referência de agenda incoerente', async () => {
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data) VALUES($1,'nao_atendeu','Tarefa concorrente',CURRENT_DATE) RETURNING id", [c.empresaId])
  await comAdmin(banco.urlAdmin, async primeiro => {
    await primeiro.query('BEGIN')
    await primeiro.query('UPDATE contato SET proximo_passo=NULL,proximo_passo_data=NULL WHERE id=$1', [id])
    try {
      await comAdmin(banco.urlAdmin, async segundo => {
        const pid = (await segundo.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid
        const tentativa = segundo.query('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresaId, id])
          .then(() => ({ ok: true }), (erro: { code: string }) => ({ ok: false, codigo: erro.code }))
        try {
          await expect.poll(async () => (await banco.sql<{ espera: string | null }>('SELECT wait_event_type AS espera FROM pg_stat_activity WHERE pid=$1', [pid]))[0]?.espera).toBe('Lock')
        } finally { await primeiro.query('COMMIT') }
        expect(await tentativa).toEqual({ ok: false, codigo: '23514' })
      })
    } finally { await primeiro.query('ROLLBACK') }
  })
  expect(await banco.sql('SELECT agenda_contato_id FROM empresa_vinculo WHERE empresa_id=$1', [c.empresaId])).toEqual([{ agenda_contato_id: null }])
})

test('agenda exige contato real da mesma empresa com tarefa e arquivada não guarda agenda', async () => {
  const [{ id: outra }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Outra','11987654321') RETURNING id")
  const [{ id: contato }] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data) VALUES($1,'nao_atendeu','Tentar novamente',CURRENT_DATE) RETURNING id", [c.empresaId])
  const [{ id: contatoAlheio }] = await banco.sql<{ id: string }>("INSERT INTO contato(empresa_id,tipo,proximo_passo,proximo_passo_data) VALUES($1,'nao_atendeu','Outro retorno',CURRENT_DATE) RETURNING id", [outra])
  await expect(banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresaId, contatoAlheio])).rejects.toMatchObject({ code: '23514' })
  await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresaId, contato])
  await expect(banco.sql('UPDATE contato SET proximo_passo=NULL,proximo_passo_data=NULL WHERE id=$1', [contato])).rejects.toMatchObject({ code: '23514' })
  await expect(banco.sql('UPDATE empresa_vinculo SET arquivada_em=now() WHERE empresa_id=$1', [c.empresaId])).rejects.toMatchObject({ code: '23514' })
  await banco.sql('UPDATE empresa_vinculo SET agenda_contato_id=NULL WHERE empresa_id=$1', [c.empresaId])
})

test('vínculo é único e positivo, com auditoria atribuída à identidade da escrita', async () => {
  await expect(banco.sql("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'banco')", [c.empresaId, c.outroId])).rejects.toMatchObject({ code: '23505' })
  await expect(banco.sql('UPDATE empresa_vinculo SET versao=0 WHERE empresa_id=$1', [c.empresaId])).rejects.toMatchObject({ code: '23514' })
  const [{ atualizado_por }] = await banco.sql<{ atualizado_por: string }>(`WITH identidade AS MATERIALIZED (SELECT set_config('app.usuario_id',$2,true))
    UPDATE empresa_vinculo SET iniciada_em=now() FROM identidade WHERE empresa_id=$1 RETURNING atualizado_por`, [c.empresaId, c.vendedorId])
  expect(atualizado_por).toBe(c.vendedorId)
})
