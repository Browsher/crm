import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'
import { vincularGrupoAtivo } from './grupos-fixtures'

let banco: BancoDeTeste
let gestor: string
let vendedor: string
let empresa: string
beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'GestorEmpWhats')
  vendedor = await criarUsuario(banco, 'vendedor', 'VendedorEmpWhats')
  const r = await banco.sql<{ id: string }>(`INSERT INTO empresa(cnpj,razao_social,nome_fantasia,telefone) VALUES
    ('11111111000111','Empresa Única','Loja Única','11911111111'),
    ('22222222000122','Empresa Dois',NULL,'11922222222'),
    ('33333333000133','Empresa Três',NULL,'11922222222') RETURNING id`)
  empresa = r[0].id
})
afterAll(async () => { await banco?.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM negociacao')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('UPDATE grupo_importacao SET ativo=false')
  await banco.sql('UPDATE usuario SET ativo=true WHERE id=$1', [vendedor])
})

test('telefone exato encontra empresa única, diferencia ausência de ambiguidade', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  expect(await consultarEmpresas(gestor, ['+5511911111111', '+5511922222222', '+5511933333333'])).toEqual({
    '+5511911111111': { telefone: '+5511911111111', estado: 'encontrada', empresa: { id: empresa, nome: 'Loja Única', situacao: 'inativa' } },
    '+5511922222222': { telefone: '+5511922222222', estado: 'ambigua' },
    '+5511933333333': { telefone: '+5511933333333', estado: 'ausente' },
  })
})

test('não adivinha país nem nono dígito e não interpreta LID como telefone', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  expect(await consultarEmpresas(gestor, ['11911111111', '123@lid', '+14155552671'])).toEqual({})
  expect((await consultarEmpresas(gestor, ['+551191111111']))['+551191111111']).toEqual({ telefone: '+551191111111', estado: 'ausente' })
})

test('vendedor não recebe dados de empresa por este caminho', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  const r = await consultarEmpresas(vendedor, ['+5511911111111'])
  expect(JSON.stringify(r)).not.toContain('Loja Única')
  expect(JSON.stringify(r)).not.toContain(empresa)
})

test('situação distingue disponível, descanso, reserva e carteira pela precedência do CRM', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  const ler = async () => (await consultarEmpresas(gestor, ['+5511911111111']))['+5511911111111']
  await vincularGrupoAtivo(banco, [empresa])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'disponivel' } })
  await banco.sql("INSERT INTO empresa_fila(empresa_id,elegivel_em) VALUES($1,now()+interval '1 day')", [empresa])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'descanso' } })
  await banco.sql("UPDATE empresa_fila SET reservado_por=$2,reservado_ate=now()+interval '1 hour' WHERE empresa_id=$1", [empresa,vendedor])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'reservada' } })
  await banco.sql('UPDATE empresa_fila SET reservado_por=NULL,reservado_ate=NULL,vendedor_id=$2 WHERE empresa_id=$1', [empresa,vendedor])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'carteira' } })
})

test('etapa só pertence ao ciclo aberto do responsável ativo atual', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  const ler = async () => (await consultarEmpresas(gestor, ['+5511911111111']))['+5511911111111']
  await banco.sql('INSERT INTO empresa_fila(empresa_id,vendedor_id) VALUES($1,$2)', [empresa,vendedor])
  await banco.sql('INSERT INTO negociacao(empresa_id,vendedor_id) VALUES($1,$2)', [empresa,vendedor])
  for (const etapa of ['primeiro_contato', 'em_negociacao', 'proposta_enviada']) {
    await banco.sql('UPDATE negociacao SET etapa=$1', [etapa])
    expect(await ler()).toMatchObject({ empresa: { situacao: etapa } })
  }
  await banco.sql("UPDATE negociacao SET encerrada_em=now(),encerramento='venda'")
  expect(await ler()).toMatchObject({ empresa: { situacao: 'carteira' } })
  await banco.sql("INSERT INTO negociacao(empresa_id,vendedor_id,etapa) VALUES($1,$2,'em_negociacao')", [empresa,gestor])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'carteira' } })
  await banco.sql('UPDATE usuario SET ativo=false WHERE id=$1', [vendedor])
  expect(await ler()).toMatchObject({ empresa: { situacao: 'inativa' } })
})
