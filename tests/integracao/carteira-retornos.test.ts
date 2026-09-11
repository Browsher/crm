import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { registrarContato } from '@/src/features/contato/repositorio'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string
let gestor: string
let empresas: string[]

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  const linhas = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone) VALUES
     ('11222333000181', 'Aurora', '11987654321'),
     ('11222333000262', 'Boreal', '11987654321'),
     ('11222333000343', 'Cristal', '11987654321'),
     ('11222333000424', 'Dourada', '11987654321') RETURNING id`,
  )
  empresas = linhas.map((e) => e.id)
})

afterAll(async () => { await banco.derrubar() })
beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
  for (const id of empresas) {
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())`,
      [id, vendedorA],
    )
  }
})

async function ler(usuario = vendedorA) {
  const r = await lerMinhasEmpresas(usuario)
  expect(r.ok).toBe(true)
  if (!r.ok) throw new Error('leitura recusada')
  return r
}

async function agendar(id: string, dias: number | null, nota = 'Retorno') {
  const [linha] = await banco.sql<{ data: string | null }>(
    `INSERT INTO contato (empresa_id, tipo, nota, proximo_passo, proximo_passo_data)
     VALUES ($1, 'acompanhamento', $3,
       CASE WHEN $2::integer IS NULL THEN NULL ELSE 'Ligar' END,
       (now() AT TIME ZONE 'America/Sao_Paulo')::date + $2::integer)
     RETURNING to_char(proximo_passo_data, 'YYYY-MM-DD') AS data`, [id, dias, nota],
  )
  return linha.data
}

test.each([
  [-1, 'atrasado', true],
  [0, 'hoje', false],
  [1, 'futuro', false],
  [null, 'sem_data', false],
] as const)('retorno com deslocamento %s e %s pelo dia civil de Sao Paulo', async (dias, situacao, vencido) => {
  const data = await agendar(empresas[0], dias)
  const empresa = (await ler()).carteira.find((e) => e.id === empresas[0])
  expect(empresa).toMatchObject({ proximoPassoData: data, situacaoRetorno: situacao, vencido })
})

test('empresa sem contato fica sem data, sem ficar atrasada', async () => {
  const empresa = (await ler()).carteira.find((e) => e.id === empresas[0])
  expect(empresa).toMatchObject({ ultimoContato: null, proximoPassoData: null, situacaoRetorno: 'sem_data', vencido: false })
})

test('contato novo substitui data antiga e contato sem data nao revive o compromisso', async () => {
  await agendar(empresas[0], -1, 'Antigo')
  const amanha = await agendar(empresas[0], 1, 'Novo')
  expect((await ler()).carteira.find((e) => e.id === empresas[0])).toMatchObject({
    ultimoContato: { nota: 'Novo' }, proximoPassoData: amanha, situacaoRetorno: 'futuro', vencido: false,
  })
  await agendar(empresas[0], null, 'Sem compromisso')
  expect((await ler()).carteira.find((e) => e.id === empresas[0])).toMatchObject({
    ultimoContato: { nota: 'Sem compromisso' }, proximoPasso: null, proximoPassoData: null, situacaoRetorno: 'sem_data', vencido: false,
  })
})

test('reserva com retorno fica fora da carteira e devolucao remove empresa agendada', async () => {
  await agendar(empresas[0], -1)
  await agendar(empresas[1], 0)
  await banco.sql(
    `UPDATE empresa_fila SET vendedor_id = NULL, reservado_por = $2, reservado_ate = now() + interval '30 minutes'
     WHERE empresa_id = $1`, [empresas[0], vendedorA],
  )
  const antes = await ler()
  expect(antes.reserva).toMatchObject({ id: empresas[0], situacaoRetorno: 'atrasado' })
  expect(antes.carteira.map((e) => e.id)).not.toContain(empresas[0])
  expect(antes.carteira.find((e) => e.id === empresas[1])).toMatchObject({ situacaoRetorno: 'hoje' })
  expect(await registrarContato(vendedorA, empresas[1], {
    tipo: 'acompanhamento', desfecho: 'devolver', nota: 'Devolvida', proximoPasso: null, proximoPassoData: null,
  })).toEqual({ ok: true })
  const depois = await ler()
  expect(depois.carteira.map((e) => e.id)).not.toContain(empresas[1])
  expect(depois.reserva?.id).toBe(empresas[0])
})

test('datas e notas ficam na carteira do dono, inclusive para gestor', async () => {
  await banco.sql('UPDATE empresa_fila SET vendedor_id = $2 WHERE empresa_id = $1', [empresas[1], vendedorB])
  await banco.sql('UPDATE empresa_fila SET vendedor_id = $2 WHERE empresa_id = $1', [empresas[2], gestor])
  await banco.sql('DELETE FROM empresa_fila WHERE empresa_id = $1', [empresas[3]])
  const ontem = await agendar(empresas[0], -1, 'Privada A')
  const hoje = await agendar(empresas[1], 0, 'Privada B')
  const amanha = await agendar(empresas[2], 1, 'Privada Gestor')
  expect((await ler(vendedorA)).carteira).toMatchObject([
    { id: empresas[0], ultimoContato: { nota: 'Privada A' }, proximoPassoData: ontem, situacaoRetorno: 'atrasado' },
  ])
  expect((await ler(vendedorB)).carteira).toMatchObject([
    { id: empresas[1], ultimoContato: { nota: 'Privada B' }, proximoPassoData: hoje, situacaoRetorno: 'hoje' },
  ])
  expect((await ler(gestor)).carteira).toMatchObject([
    { id: empresas[2], ultimoContato: { nota: 'Privada Gestor' }, proximoPassoData: amanha, situacaoRetorno: 'futuro' },
  ])
})
