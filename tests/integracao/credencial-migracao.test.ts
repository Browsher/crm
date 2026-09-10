import { mkdtemp, readdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'
import { criarBancoDeTeste, criarUsuario } from './ajuda'

test('0022 atualiza banco povoado em 0021 preservando sessões e atribuindo versão inicial', async () => {
  const banco = await criarBancoDeTeste({ semMigracoes: true })
  const pasta = await mkdtemp(join(tmpdir(), 'crm-migracao-0021-'))
  try {
    for (const nome of (await readdir(PASTA_MIGRACOES)).filter(n => n.endsWith('.sql') && n < '0022')) {
      await copyFile(join(PASTA_MIGRACOES, nome), join(pasta, nome))
    }
    expect(await aplicar(banco.urlAdmin, pasta)).toMatchObject({ ok: true })
    const id = await criarUsuario(banco, 'vendedor', 'Existente')
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'hash-anterior'])
    await banco.sql("SELECT autenticacao.sessao_criar($1, 'sessao-existente', now() + interval '1 hour')", [id])
    expect(await aplicar(banco.urlAdmin, PASTA_MIGRACOES)).toEqual({ ok: true, aplicadas: ['0022_credencial_vigente.sql'] })
    expect(await banco.sql('SELECT senha_hash, versao FROM autenticacao.credencial WHERE usuario_id = $1', [id]))
      .toEqual([{ senha_hash: 'hash-anterior', versao: '1' }])
    expect(await banco.sql("SELECT usuario_id FROM autenticacao.sessao_atual('sessao-existente')")).toEqual([{ usuario_id: id }])
    expect(await banco.sql("SELECT * FROM autenticacao.sessao_criar($1, 'nova', now() + interval '1 hour', 1)", [id]))
      .toEqual([{ senha_provisoria_pendente: false }])
    await banco.sql("SELECT autenticacao.senha_trocar('sessao-existente', 'novo')")
    expect(await banco.sql('SELECT versao FROM autenticacao.credencial WHERE usuario_id = $1', [id])).toEqual([{ versao: '2' }])
    expect(await banco.sql('SELECT token_hash FROM autenticacao.sessao WHERE usuario_id = $1', [id]))
      .toEqual([{ token_hash: 'sessao-existente' }])
    expect(await banco.sql("SELECT * FROM autenticacao.sessao_criar($1, 'revogada', now() + interval '1 hour', 1)", [id])).toEqual([])
    expect(await conferirInvariantes(banco.urlAdmin)).toEqual({ ok: true })
    expect(await banco.sql(`SELECT p.proname AS nome, p.proowner = c.relowner AS mesmo_dono
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN pg_class c WHERE c.oid = 'autenticacao.credencial'::regclass
      AND n.nspname = 'autenticacao' AND p.proname IN ('credencial_por_email', 'sessao_criar') ORDER BY p.proname`))
      .toEqual([{ nome: 'credencial_por_email', mesmo_dono: true }, { nome: 'sessao_criar', mesmo_dono: true }])
  } finally {
    await banco.derrubar()
    // mkdtemp cria exclusivamente esta pasta no diretório temporário do SO.
    await rm(pasta, { recursive: true, force: true })
  }
})
