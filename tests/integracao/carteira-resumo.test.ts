import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string
let gestor: string
let empresaA: string
let empresaB: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  const empresas = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone, cnae_principal) VALUES
     ('11222333000181', 'Aurora', '11987654321', NULL),
     ('11222333000262', 'Boreal', '11987654321', '4754703') RETURNING id`,
  )
  empresaA = empresas[0].id
  empresaB = empresas[1].id
})

afterAll(async () => { await banco.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em)
     VALUES ($1, $2, now()), ($3, $4, now())`,
    [empresaA, vendedorA, empresaB, vendedorB],
  )
})

async function carteira(usuario: string) {
  const r = await lerMinhasEmpresas(usuario)
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error('leitura recusada')
  return r.carteira
}

test('sem contato retorna resumo nulo e preserva CNAE ausente ou informado', async () => {
  expect(await carteira(vendedorA)).toMatchObject([{ id: empresaA, ultimoContato: null, cnaePrincipal: null }])
  expect(await carteira(vendedorB)).toMatchObject([{ id: empresaB, ultimoContato: null, cnaePrincipal: '4754703' }])
})

test('contato com nota nula continua sendo um contato com data', async () => {
  const [contato] = await banco.sql<{ criado_em: Date }>(
    `INSERT INTO contato (empresa_id, tipo) VALUES ($1, 'nao_atendeu') RETURNING criado_em`, [empresaA],
  )
  expect((await carteira(vendedorA))[0].ultimoContato).toEqual({ nota: null, criadoEm: contato.criado_em })
})

test('data mais recente vence mesmo quando seu id e menor', async () => {
  // Transações separadas deixam a auditoria produzir os instantes reais.
  await banco.sql(
    `INSERT INTO contato (id, empresa_id, tipo, nota)
     VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', $1, 'acompanhamento', 'Conversa antiga') RETURNING criado_em`, [empresaA],
  )
  const [recente] = await banco.sql<{ criado_em: Date }>(
    `INSERT INTO contato (id, empresa_id, tipo, nota)
     VALUES ('11111111-1111-4111-8111-111111111111', $1, 'acompanhamento', 'Conversa mais recente') RETURNING criado_em`, [empresaA],
  )
  const [ordem] = await banco.sql<{ distinta: boolean }>(
    `SELECT recente.criado_em > antigo.criado_em AS distinta
       FROM contato recente CROSS JOIN contato antigo
      WHERE recente.id = '11111111-1111-4111-8111-111111111111'
        AND antigo.id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'`,
  )
  expect(ordem.distinta).toBe(true)
  expect((await carteira(vendedorA))[0].ultimoContato).toEqual({ nota: 'Conversa mais recente', criadoEm: recente.criado_em })
})

test('empate em criado_em usa o maior id, sem duplicar a empresa', async () => {
  // Um statement produz o mesmo now() em ambas as linhas, sem desativar auditoria.
  const contatos = await banco.sql<{ criado_em: Date }>(
    `INSERT INTO contato (id, empresa_id, tipo, nota) VALUES
     ('ffffffff-ffff-4fff-8fff-ffffffffffff', $1, 'acompanhamento', 'Maior id'),
     ('11111111-1111-4111-8111-111111111111', $1, 'acompanhamento', 'Menor id') RETURNING criado_em`, [empresaA],
  )
  expect(contatos[0].criado_em).toEqual(contatos[1].criado_em)
  expect(await carteira(vendedorA)).toMatchObject([{ id: empresaA, ultimoContato: { nota: 'Maior id', criadoEm: contatos[0].criado_em } }])
})

test('cada vendedor recebe apenas sua nota e gestor nao recebe carteira global', async () => {
  await banco.sql(
    `INSERT INTO contato (empresa_id, tipo, nota) VALUES
     ($1, 'acompanhamento', 'Privada A'), ($2, 'acompanhamento', 'Privada B')`, [empresaA, empresaB],
  )
  expect(await carteira(vendedorA)).toMatchObject([{ id: empresaA, ultimoContato: { nota: 'Privada A' } }])
  expect(await carteira(vendedorB)).toMatchObject([{ id: empresaB, ultimoContato: { nota: 'Privada B' } }])
  expect(await carteira(gestor)).toEqual([])
})
