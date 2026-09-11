import { mkdtemp, readdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { comAdmin } from '@/src/server/db/admin'
import { criarBancoDeTeste, criarUsuario } from './ajuda'

test('0026 inicializa dez empresas por autor usando último contato e ignora autor nulo', async () => {
  const banco = await criarBancoDeTeste({ semMigracoes: true })
  const pasta = await mkdtemp(join(tmpdir(), 'crm-migracao-0026-'))
  try {
    for (const nome of (await readdir(PASTA_MIGRACOES)).filter(n => n.endsWith('.sql') && n < '0026')) {
      await copyFile(join(PASTA_MIGRACOES,nome), join(pasta,nome))
    }
    expect(await aplicar(banco.urlAdmin,pasta)).toMatchObject({ ok:true })
    const autor = await criarUsuario(banco,'vendedor','HistoricoAutor')
    const outro = await criarUsuario(banco,'vendedor','HistoricoOutro')
    const ids: string[] = []
    await comAdmin(banco.urlAdmin, async c => {
      await c.query('BEGIN')
      await c.query('ALTER TABLE contato DISABLE TRIGGER contato_auditoria')
      for (let i = 0; i < 12; i++) {
        const { rows } = await c.query('INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ($1,\'Histórica\',\'11999999999\') RETURNING id', [String(i+1).padStart(14,'0')])
        ids.push(rows[0].id)
        await c.query("INSERT INTO contato(empresa_id,tipo,criado_por,criado_em) VALUES ($1,'ligacao',$2,'2026-01-01'::timestamptz+$3*interval '1 day')", [ids[i],autor,i])
      }
      await c.query("INSERT INTO contato(empresa_id,tipo,criado_por,criado_em) VALUES ($1,'ligacao',$2,'2026-03-01'),($1,'ligacao',$3,'2026-04-01'),($1,'ligacao',NULL,'2026-05-01')", [ids[0],autor,outro])
      await c.query('ALTER TABLE contato ENABLE TRIGGER contato_auditoria')
      await c.query('COMMIT')
    })
    expect(await aplicar(banco.urlAdmin,PASTA_MIGRACOES)).toEqual({ ok:true, aplicadas:['0026_empresa_recentes.sql'] })
    const linhas = await banco.sql<{empresa_id:string}>('SELECT empresa_id FROM empresa_recente WHERE usuario_id=$1 ORDER BY acessada_em DESC,empresa_id', [autor])
    expect(linhas.map(r => r.empresa_id)).toEqual([ids[0],...ids.slice(3).reverse()])
    expect(await banco.sql('SELECT empresa_id FROM empresa_recente WHERE usuario_id=$1',[outro])).toEqual([{empresa_id:ids[0]}])
    expect(await banco.sql('SELECT count(*)::int AS n FROM empresa_recente')).toEqual([{n:11}])
  } finally {
    await banco.derrubar()
    await rm(pasta,{recursive:true,force:true})
  }
})
