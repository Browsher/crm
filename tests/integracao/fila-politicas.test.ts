import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedorA: string
let vendedorB: string
let empresa: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone)
     VALUES ('11222333000181', 'Aurora Comercio LTDA', '11987654321') RETURNING id`,
  )
  empresa = linha.id
})
afterAll(async () => {
  await banco.derrubar()
})

// Reserva vigente para o vendedor A, escrita como dona: a RLS não vale aqui e
// é isso que faz dela preparação de cenário, não exercício do desenho.
async function reservarPara(usuarioId: string, minutos = 30): Promise<void> {
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval, now())
     ON CONFLICT (empresa_id) DO UPDATE
        SET reservado_por = excluded.reservado_por,
            reservado_ate = excluded.reservado_ate,
            vendedor_id = NULL`,
    [empresa, usuarioId, String(minutos)],
  )
}

describe('empresa_fila: privilégios', () => {
  test('app_teste fora de comoUsuario e 42501, nao zero linhas', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      await expect(c.query('SELECT empresa_id FROM empresa_fila')).rejects.toMatchObject({ code: '42501' })
    } finally {
      c.release()
    }
  })

  const escritas: [string, string][] = [
    ['INSERT', "INSERT INTO empresa_fila (empresa_id) VALUES ('11111111-1111-4111-8111-111111111111')"],
    ['UPDATE', 'UPDATE empresa_fila SET vendedor_id = NULL'],
    ['DELETE', 'DELETE FROM empresa_fila'],
  ]
  for (const [verbo, sql] of escritas) {
    test(`${verbo} e 42501 por falta de GRANT, inclusive para o gestor`, async () => {
      await expect(banco.comoUsuario(gestor, (e) => e(sql))).rejects.toMatchObject({ code: '42501' })
    })
  }
})

describe('empresa_fila: quem le a linha', () => {
  test('vendedor le a reserva dele', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(vendedorA, (e) => e('SELECT empresa_id FROM empresa_fila'))
    expect(r.linhas).toEqual([{ empresa_id: empresa }])
  })

  test('vendedor nao le a linha de outro vendedor', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(vendedorB, (e) => e('SELECT empresa_id FROM empresa_fila'))
    expect(r.linhas).toEqual([])
  })

  test('gestor le todas', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(gestor, (e) => e('SELECT empresa_id FROM empresa_fila'))
    expect(r.linhas).toHaveLength(1)
  })
})

describe('empresa_leitura: o vendedor le so o que esta com ele', () => {
  test('com reserva vigente, le a empresa', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(vendedorA, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toEqual([{ cnpj: '11222333000181' }])
  })

  test('empresa alheia continua invisivel', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(vendedorB, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toEqual([])
  })

  test('reserva expirada deixa de dar leitura', async () => {
    await reservarPara(vendedorA, -1)
    const r = await banco.comoUsuario(vendedorA, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toEqual([])
  })

  test('posse da leitura sem prazo', async () => {
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em)
       VALUES ($1, $2, now())
       ON CONFLICT (empresa_id) DO UPDATE
          SET vendedor_id = excluded.vendedor_id, reservado_por = NULL, reservado_ate = NULL`,
      [empresa, vendedorA],
    )
    const r = await banco.comoUsuario(vendedorA, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toEqual([{ cnpj: '11222333000181' }])
  })

  test('gestor continua lendo tudo', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(gestor, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toHaveLength(1)
  })

  // ESTE TESTE EXISTE PARA EXPLICAR, NÃO PARA PEGAR.
  //
  // `empresa_leitura` consulta `empresa_fila`, e a RLS de `empresa_fila` vale
  // dentro dessa subconsulta. Se alguém estreitar `empresa_fila_leitura`, quem
  // falha é o teste "com reserva vigente, le a empresa" — apontando `empresa`,
  // quando a causa está na outra tabela. Este falha junto e nomeia a causa.
  //
  // Não existe catraca para isso: invariante que leia `qual` de política
  // arbitrária compararia texto de expressão, que muda na primeira
  // reformatação do Postgres.
  test('empresa_leitura depende de empresa_fila_leitura enxergar a propria linha', async () => {
    await reservarPara(vendedorA)
    const r = await banco.comoUsuario(vendedorA, (e) =>
      e('SELECT reservado_por FROM empresa_fila WHERE empresa_id = $1', [empresa]),
    )
    expect(r.linhas).toEqual([{ reservado_por: vendedorA }])
  })
})

describe('empresa_fila: os dois CHECK', () => {
  test('posse e reserva juntas e recusado', async () => {
    await expect(
      banco.sql(
        `INSERT INTO empresa_fila (empresa_id, vendedor_id, reservado_por, reservado_ate)
         VALUES ($1, $2, $2, now() + interval '30 minutes')
         ON CONFLICT (empresa_id) DO UPDATE
            SET vendedor_id = excluded.vendedor_id, reservado_por = excluded.reservado_por,
                reservado_ate = excluded.reservado_ate`,
        [empresa, vendedorA],
      ),
    ).rejects.toMatchObject({ constraint: 'empresa_fila_posse_ou_reserva' })
  })

  test('reserva sem prazo e recusada', async () => {
    await expect(
      banco.sql(
        `INSERT INTO empresa_fila (empresa_id, reservado_por) VALUES ($1, $2)
         ON CONFLICT (empresa_id) DO UPDATE
            SET reservado_por = excluded.reservado_por, reservado_ate = NULL, vendedor_id = NULL`,
        [empresa, vendedorA],
      ),
    ).rejects.toMatchObject({ constraint: 'empresa_fila_reserva_coerente' })
  })
})
