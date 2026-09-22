import { test, expect } from 'vitest'
import { mkdtemp, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { criarBancoDeTeste, criarUsuario } from './ajuda'
import { aplicar } from '@/src/server/db/migracoes/aplicar'
import { lerMigracoes, PASTA_MIGRACOES } from '@/src/server/db/migracoes/arquivos'
import { conferirInvariantes } from '@/src/server/db/migracoes/invariantes'

test('atualização preserva dados anteriores, cria só ciclos de posse e não inventa vendas', async () => {
  const banco = await criarBancoDeTeste({semMigracoes:true})
  const pasta = await mkdtemp(join(tmpdir(),'crm-funil-migracao-'))
  try {
    const migracoes = await lerMigracoes(PASTA_MIGRACOES)
    for (const m of migracoes.filter(m=>m.nome < '0028')) await copyFile(join(PASTA_MIGRACOES,m.nome),join(pasta,m.nome))
    expect((await aplicar(banco.urlAdmin,pasta)).ok).toBe(true)
    const a = await criarUsuario(banco,'vendedor','Ana')
    const b = await criarUsuario(banco,'vendedor','Bia')
    const empresas = await banco.sql<{id:string}>("INSERT INTO empresa(cnpj,razao_social,telefone) VALUES('11222333000181','Antiga','11987654321'),('11222333000182','Reservada','11987654321') RETURNING id")
    await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)',[empresas[0].id,a])
    await banco.sql("INSERT INTO empresa_fila(empresa_id,reservado_por,reservado_ate) VALUES($1,$2,now()+interval '30 minutes')",[empresas[1].id,b])
    await banco.sql("INSERT INTO contato(empresa_id,tipo,nota) VALUES($1,'interessado','Nota anterior')",[empresas[0].id])
    const antes = await banco.sql('SELECT * FROM empresa_fila ORDER BY empresa_id')
    expect(await aplicar(banco.urlAdmin,PASTA_MIGRACOES)).toEqual({ok:true,aplicadas:['0028_comercial.sql', '0029_funil_comandos.sql', '0030_funil_avanco.sql', '0031_vendas_carteira_agenda.sql', '0032_whatsapp_vinculo.sql']})
    expect(await banco.sql('SELECT * FROM empresa_fila ORDER BY empresa_id')).toEqual(antes)
    expect(await banco.sql('SELECT nota FROM contato')).toEqual([{nota:'Nota anterior'}])
    expect(await banco.sql('SELECT empresa_id,vendedor_id,etapa,encerramento FROM negociacao')).toEqual([
      {empresa_id:empresas[0].id,vendedor_id:a,etapa:'primeiro_contato',encerramento:null},
    ])
    expect(await banco.sql('SELECT * FROM venda')).toEqual([])
    expect(await conferirInvariantes(banco.urlAdmin)).toEqual({ok:true})
    expect(await aplicar(banco.urlAdmin,PASTA_MIGRACOES)).toEqual({ok:true,aplicadas:[]})
    expect(await banco.sql('SELECT id FROM negociacao')).toHaveLength(1)
  } finally {
    await banco.derrubar()
    await rm(pasta,{recursive:true,force:true})
  }
})
