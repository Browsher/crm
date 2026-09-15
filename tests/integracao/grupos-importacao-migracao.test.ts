import { mkdtemp, readdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { criarBancoDeTeste, criarUsuario } from './ajuda'

test('0027 em banco vazio não cria Base de testes antes de qualquer limpeza de cenário', async () => {
  const banco = await criarBancoDeTeste()
  try {
    // Não há beforeEach nem DELETE: uma criação incondicional na migração
    // deixa evidência aqui, mesmo quando nenhuma empresa foi vinculada.
    expect(await banco.sql('SELECT cnpj FROM empresa')).toEqual([])
    expect(await banco.sql('SELECT nome FROM grupo_importacao')).toEqual([])
    expect(await banco.sql('SELECT empresa_id FROM grupo_importacao_empresa')).toEqual([])
  } finally {
    await banco.derrubar()
  }
})

test('0027 preserva empresas, contatos, carteira, reserva e recentes na Base de testes, sem autovínculo futuro', async () => {
  const banco = await criarBancoDeTeste({semMigracoes:true})
  const pasta = await mkdtemp(join(tmpdir(), 'crm-migracao-0027-'))
  try {
    for (const nome of (await readdir(PASTA_MIGRACOES)).filter(n => n.endsWith('.sql') && n < '0027')) {
      await copyFile(join(PASTA_MIGRACOES, nome), join(pasta, nome))
    }
    expect(await aplicar(banco.urlAdmin, pasta)).toMatchObject({ok:true})
    const vendedor = await criarUsuario(banco, 'vendedor', 'Transicao')
    const empresas = await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('00000000000001','Carteira','11999999999'),('00000000000002','Reserva','11999999999') RETURNING id")
    await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES ($1,$2)', [empresas[0].id,vendedor])
    await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES ($1,$2,now()+interval '20 minutes')", [empresas[1].id,vendedor])
    await banco.sql("INSERT INTO contato(empresa_id,tipo,nota) VALUES ($1,'ligacao','Histórico preservado')", [empresas[0].id])
    await banco.sql('INSERT INTO empresa_recente(usuario_id,empresa_id,acessada_em) VALUES ($1,$2,now())', [vendedor,empresas[1].id])
    const tabelas = ['usuario','empresa','empresa_fila','contato','empresa_recente']
    const antes = await Promise.all(tabelas.map(t => banco.sql(`SELECT * FROM ${t} ORDER BY 1`)))
    expect(await aplicar(banco.urlAdmin, PASTA_MIGRACOES)).toEqual({ok:true,aplicadas:['0027_grupos_importacao.sql', '0028_comercial.sql']})
    expect(await Promise.all(tabelas.map(t => banco.sql(`SELECT * FROM ${t} ORDER BY 1`)))).toEqual(antes)
    expect(await banco.sql('SELECT nome,ativo,arquivo_nome,criado_por,vinculadas FROM grupo_importacao')).toEqual([{nome:'Base de testes',ativo:true,arquivo_nome:null,criado_por:null,vinculadas:2}])
    expect(await banco.sql('SELECT empresa_id FROM grupo_importacao_empresa ORDER BY empresa_id')).toEqual(empresas.map(e=>({empresa_id:e.id})).sort((a,b)=>a.empresa_id.localeCompare(b.empresa_id)))
    const [{id}] = await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES ('00000000000003','Posterior','11999999999') RETURNING id")
    expect(await banco.sql('SELECT * FROM grupo_importacao_empresa WHERE empresa_id=$1', [id])).toEqual([])
  } finally {
    await banco.derrubar()
    await rm(pasta,{recursive:true,force:true})
  }
})
