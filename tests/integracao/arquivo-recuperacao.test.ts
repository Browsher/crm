import { randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
import { cenarioAtendimento } from './atendimento-fixtures'
import { comAdmin, comBanco } from '@/src/server/db/admin'
import { exigirHostLocal } from '@/src/server/db/host-local'

let origem: BancoDeTeste
let copiaNome: string | undefined
const servidor = process.env.DATABASE_URL_ADMIN!
beforeAll(async () => { origem = await criarBancoDeTeste() })
afterAll(async () => {
  if (copiaNome) await comAdmin(servidor,c => c.query(`DROP DATABASE IF EXISTS ${copiaNome} WITH (FORCE)`))
  await origem?.derrubar()
})

test('backup do CLI recupera campos e auditoria em clone isolado, preservando contatos, vendas e autores', async () => {
  const c = await cenarioAtendimento(origem)
  const [{ grupo_id: grupo }] = await origem.sql<{ grupo_id: string }>('SELECT grupo_id FROM grupo_importacao_empresa WHERE empresa_id=$1', [c.empresaId])
  const extras = await origem.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('Venda sintética recuperável','11911112222'),('Pendência sintética recuperável','11933334444') RETURNING id")
  const venda = extras[0].id
  const pendencia = extras[1].id
  await origem.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) SELECT $1,unnest($2::uuid[])', [grupo,extras.map(e => e.id)])
  await comAdmin(origem.urlAdmin,async cliente => {
    await cliente.query('BEGIN')
    try {
      await cliente.query("SELECT set_config('app.usuario_id',$1,true)", [c.vendedorId])
      await cliente.query('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [venda,c.vendedorId])
      await cliente.query("INSERT INTO empresa_vinculo(empresa_id,vendedor_id,origem_inicial) VALUES($1,$2,'legado')", [venda,c.vendedorId])
      await cliente.query('INSERT INTO venda(empresa_id,autor_id,data,valor_centavos,chave,observacao) VALUES($1,$2,CURRENT_DATE,23456,$3,\'Venda sintética original\')', [venda,c.vendedorId,randomUUID()])
      const contato = (await cliente.query<{ id: string }>("INSERT INTO contato(empresa_id,tipo,nota,proximo_passo,proximo_passo_data) VALUES($1,'interessado','Contato sintético original','Retorno sintético original',CURRENT_DATE) RETURNING id", [c.empresaId])).rows[0].id
      await cliente.query('UPDATE empresa_vinculo SET agenda_contato_id=$2 WHERE empresa_id=$1', [c.empresaId,contato])
      await cliente.query('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)', [c.empresaId,c.vendedorId])
      await cliente.query("INSERT INTO empresa_vinculo_pendencia(empresa_id,motivo,candidatos,evidencias) VALUES($1,'sem_evidencia',$2,'{\"teste\":\"recuperacao\"}')", [pendencia,[c.vendedorId]])
      await cliente.query('COMMIT')
    } catch (erro) { await cliente.query('ROLLBACK'); throw erro }
  })
  const pasta = resolve('.superpowers/sdd/limpeza-legado-2026-10-30/ensaios-recuperacao',randomUUID())
  await mkdir(pasta,{ recursive: true })
  const manifestoPath = resolve(pasta,'manifesto.json')
  const backupPath = resolve(pasta,'backup.json')
  const cli = (...args: string[]) => promisify(execFile)(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),resolve('scripts/empresas/arquivar-legado.mts'),...args], { env: { ...process.env, DATABASE_URL_ADMIN: origem.urlAdmin, PG_SSL: 'off' }, maxBuffer: 100_000 })
  const comum = ['--ensaio-local','--manifesto',manifestoPath,'--backup',backupPath]
  await cli('--simular','--grupos',grupo,...comum)
  const backup = await readFile(backupPath,'utf8')
  const conteudo = JSON.parse(backup) as { assinatura: string; manifesto: Record<string, unknown> }
  const usuarios = (await origem.sql<{ dados: unknown }>('SELECT jsonb_agg(to_jsonb(u) ORDER BY id) AS dados FROM usuario u'))[0].dados
  await cli('--aplicar',...comum,'--confirmar-sha',conteudo.assinatura)

  exigirHostLocal(servidor)
  if (!/^teste_[0-9a-f]{12}$/.test(origem.nome)) throw new Error('Template precisa ser banco do harness')
  copiaNome = 'teste_'+randomBytes(6).toString('hex')
  await comAdmin(servidor,c => c.query(`CREATE DATABASE ${copiaNome} TEMPLATE ${origem.nome}`))
  const copiaUrl = comBanco(servidor,copiaNome)
  exigirHostLocal(copiaUrl)
  const ler = (tabela: string, ordenar: string) => comAdmin(copiaUrl,async c => (await c.query<{ dados: unknown }>(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY ${ordenar}),'[]'::jsonb) AS dados FROM public.${tabela} t`)).rows[0].dados)
  expect(await ler('empresa_arquivo','empresa_id')).toHaveLength(3)
  expect(await ler('negociacao','id')).not.toEqual(conteudo.manifesto.negociacao)
  expect(await ler('empresa_vinculo_pendencia','empresa_id')).not.toEqual(conteudo.manifesto.empresa_vinculo_pendencia)

  const procedimento = await readFile(resolve('docs/operacao/arquivamento-legado-recuperacao.sql'),'utf8')
  await comAdmin(copiaUrl,async c => {
    await c.query('BEGIN')
    try {
      await c.query('CREATE TEMP TABLE recuperacao_arquivo(backup jsonb NOT NULL,conteudo text NOT NULL) ON COMMIT DROP')
      await c.query('INSERT INTO recuperacao_arquivo(backup,conteudo) VALUES($1::jsonb,$2::text)', [backup,backup])
      await c.query(procedimento)
      await c.query('COMMIT')
    } catch (erro) { await c.query('ROLLBACK'); throw erro }
  })
  for (const [tabela,chave,ordem] of [['grupo_importacao','grupos','id'],['empresa_vinculo','empresa_vinculo','empresa_id'],['negociacao','negociacao','id'],['empresa_vinculo_pendencia','empresa_vinculo_pendencia','empresa_id']]) {
    const original = conteudo.manifesto[chave] as unknown[]
    const recuperado = await ler(tabela,ordem)
    expect(recuperado).toHaveLength(original.length)
    expect(recuperado).toEqual(expect.arrayContaining(original))
  }
  expect(await ler('contato','id')).toEqual(conteudo.manifesto.contato)
  expect(await ler('venda','id')).toEqual(conteudo.manifesto.venda)
  expect(await ler('usuario','id')).toEqual(usuarios)
  expect(await ler('empresa_arquivo','empresa_id')).toHaveLength(3)
  await expect(comAdmin(copiaUrl,cliente => cliente.query('UPDATE empresa_vinculo SET versao=versao+1 WHERE empresa_id=$1', [c.empresaId]))).rejects.toMatchObject({ code: '23514' })
  expect((await comAdmin(copiaUrl,c => c.query<{ desabilitados: string }>("SELECT count(*)::text AS desabilitados FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='D'"))).rows[0].desabilitados).toBe('0')
})
