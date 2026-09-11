import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { historicoDaAgenda } from '@/app/meu-dia/historico'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

const EMPRESA_INEXISTENTE = '00000000-0000-0000-0000-000000000000'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string
let gestor: string
let empresaDoA: string
let empresaDoGestor: string
let empresaReservada: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  const linhas = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone) VALUES
     ('11222333000181', 'Aurora', '11987654321'),
     ('11222333000262', 'Boreal', '11987654321'),
     ('11222333000343', 'Cristal', '11987654321') RETURNING id`,
  )
  ;[empresaDoA, empresaDoGestor, empresaReservada] = linhas.map((e) => e.id)
})

afterAll(async () => { await banco.derrubar() })

beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())`,
    [empresaDoA, vendedorA],
  )
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())`,
    [empresaDoGestor, vendedorA],
  )
  // reserva temporária: sem vendedor_id, com reservado_por e prazo vigente.
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, reservado_por, reservado_ate, primeira_reserva_em)
     VALUES ($1, NULL, $2, now() + interval '30 minutes', now())`,
    [empresaReservada, vendedorA],
  )
})

async function registrar(empresaId: string, nota: string) {
  await banco.sql(
    `INSERT INTO contato (empresa_id, tipo, nota) VALUES ($1, 'acompanhamento', $2)`,
    [empresaId, nota],
  )
}

test('dono lê o histórico da própria empresa', async () => {
  await registrar(empresaDoA, 'Primeira conversa')
  await registrar(empresaDoA, 'Segunda conversa')
  const r = await historicoDaAgenda(vendedorA, empresaDoA)
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.contatos.map((c) => c.nota)).toEqual(['Segunda conversa', 'Primeira conversa'])
})

test('outro vendedor não lê, e a resposta não distingue empresa inexistente', async () => {
  expect(await historicoDaAgenda(vendedorB, empresaDoA)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
  expect(await historicoDaAgenda(vendedorB, EMPRESA_INEXISTENTE)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
})

test('gestor lê a própria carteira e não a do vendedor', async () => {
  await banco.sql('UPDATE empresa_fila SET vendedor_id = $1 WHERE empresa_id = $2', [gestor, empresaDoGestor])
  expect((await historicoDaAgenda(gestor, empresaDoGestor)).ok).toBe(true)
  expect(await historicoDaAgenda(gestor, empresaDoA)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
})

test('perder a posse revoga a leitura, mesmo com contato antigo gravado', async () => {
  await registrar(empresaDoA, 'Conversa antiga')
  expect((await historicoDaAgenda(vendedorA, empresaDoA)).ok).toBe(true)
  await banco.sql('UPDATE empresa_fila SET vendedor_id = NULL WHERE empresa_id = $1', [empresaDoA])
  expect(await historicoDaAgenda(vendedorA, empresaDoA)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
})

test('reserva temporária não é carteira e não abre o histórico', async () => {
  expect(await historicoDaAgenda(vendedorA, empresaReservada)).toEqual({ ok: false, motivo: 'fora_da_carteira' })
})
