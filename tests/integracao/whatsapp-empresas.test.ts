import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

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

test('telefone exato encontra empresa única, diferencia ausência de ambiguidade', async () => {
  const { consultarEmpresas } = await import('@/src/server/whatsapp/empresas')
  expect(await consultarEmpresas(gestor, ['+5511911111111', '+5511922222222', '+5511933333333'])).toEqual({
    '+5511911111111': { telefone: '+5511911111111', estado: 'encontrada', empresa: { id: empresa, nome: 'Loja Única' } },
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
