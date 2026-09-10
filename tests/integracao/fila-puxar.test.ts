import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string

type Puxada = { empresa_id: string; reservado_ate: string }

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedorA = await criarUsuario(banco, 'vendedor', 'VendedorA')
  vendedorB = await criarUsuario(banco, 'vendedor', 'VendedorB')
})
afterAll(async () => {
  await banco.derrubar()
})

beforeEach(async () => {
  await banco.sql('DELETE FROM empresa_fila')
  await banco.sql('DELETE FROM empresa')
})

// `criado_em` NÃO é ajustável: o gatilho `definir_auditoria` a sobrescreve com
// now() no INSERT e restaura OLD.criado_em no UPDATE. Então a alavanca de ordem
// é a ORDEM DE INSERÇÃO — cada `banco.sql` é uma transação própria, e now() é o
// instante de início da transação, então os valores saem distintos.
//
// Quem chama estes helpers em teste de ordem insere primeiro a que deve sair
// primeiro. `elegivel_em`, ao contrário, é livre: nenhum gatilho a toca.
async function criarEmpresa(sufixo: string): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    `INSERT INTO empresa (cnpj, razao_social, telefone)
     VALUES ($1, $2, '11987654321') RETURNING id`,
    [`1122233300${sufixo}`, `Empresa ${sufixo}`],
  )
  return linha.id
}

function puxar(usuarioId: string): Promise<Puxada[]> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<Puxada>('SELECT empresa_id, reservado_ate FROM fila_puxar()')
    return r.linhas
  })
}

describe('fila_puxar: a entrega', () => {
  test('base vazia devolve zero linhas, nao nulo', async () => {
    expect(await puxar(vendedorA)).toEqual([])
  })

  test('entrega a empresa e devolve o instante do vencimento', async () => {
    const id = await criarEmpresa('0181')
    const linhas = await puxar(vendedorA)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].empresa_id).toBe(id)
    // O prazo vem do banco. O teste confere que existe e que é futuro; o
    // número 30 não aparece em TypeScript nenhum, aqui incluído.
    expect(new Date(linhas[0].reservado_ate).getTime()).toBeGreaterThan(Date.now())
  })

  test('grava primeira_reserva_em na primeira vez e nao a sobrescreve na segunda', async () => {
    await criarEmpresa('0181')
    await puxar(vendedorA)
    const [antes] = await banco.sql<{ primeira_reserva_em: Date }>('SELECT primeira_reserva_em FROM empresa_fila')
    await banco.sql('UPDATE empresa_fila SET reservado_por = NULL, reservado_ate = NULL')
    await puxar(vendedorA)
    const [depois] = await banco.sql<{ primeira_reserva_em: Date }>('SELECT primeira_reserva_em FROM empresa_fila')
    expect(depois.primeira_reserva_em).toEqual(antes.primeira_reserva_em)
  })

  test('senha provisoria pendente e 42501', async () => {
    await criarEmpresa('0181')
    const pendente = await criarUsuario(banco, 'vendedor', 'Pendente')
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [pendente])
    await expect(puxar(pendente)).rejects.toMatchObject({ code: '42501' })
  })
})

describe('fila_puxar: uma reserva por vendedor', () => {
  test('puxar de novo libera a anterior e entrega OUTRA', async () => {
    const primeira = await criarEmpresa('0181')
    const segunda = await criarEmpresa('0270')
    const [a] = await puxar(vendedorA)
    const [b] = await puxar(vendedorA)
    expect(a.empresa_id).toBe(primeira)
    expect(b.empresa_id).toBe(segunda)
    const linhas = await banco.sql<{ empresa_id: string; reservado_por: string | null }>(
      'SELECT empresa_id, reservado_por FROM empresa_fila ORDER BY empresa_id',
    )
    expect(linhas.filter((l) => l.reservado_por === vendedorA)).toHaveLength(1)
  })

  test('com uma empresa so, puxar de novo devolve zero linhas', async () => {
    await criarEmpresa('0181')
    await puxar(vendedorA)
    // A anterior é excluída da busca: sem isso, "puxar outra" devolveria a
    // mesma e o botão não sairia do lugar.
    expect(await puxar(vendedorA)).toEqual([])
  })
})

describe('fila_puxar: a ordem', () => {
  test('nunca reservada vem antes de devolvida', async () => {
    // A devolvida entra PRIMEIRO na base, então ela ganharia por criado_em se
    // a primeira chave não fosse elegivel_em.
    const devolvida = await criarEmpresa('0181')
    const intocada = await criarEmpresa('0270')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, elegivel_em, primeira_reserva_em)
       VALUES ($1, now() - interval '40 days', now() - interval '70 days')`,
      [devolvida],
    )
    const [linha] = await puxar(vendedorA)
    expect(linha.empresa_id).toBe(intocada)
  })

  test('entre nunca reservadas, a mais antiga na base', async () => {
    const antiga = await criarEmpresa('0181')
    const nova = await criarEmpresa('0270')
    const [linha] = await puxar(vendedorA)
    expect(linha.empresa_id).toBe(antiga)
    expect(linha.empresa_id).not.toBe(nova)
  })

  test('a abandonada volta ao grupo das intocadas, nao para o fim', async () => {
    // Puxada e nunca devolvida: reserva expirou, `elegivel_em` ficou nulo.
    const abandonada = await criarEmpresa('0181')
    const recente = await criarEmpresa('0270')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() - interval '1 hour', now() - interval '2 hours')`,
      [abandonada, vendedorB],
    )
    const [linha] = await puxar(vendedorA)
    expect(linha.empresa_id).toBe(abandonada)
    expect(linha.empresa_id).not.toBe(recente)
  })

  test('entre devolvidas, a que voltou ha mais tempo', async () => {
    // `tarde` entra primeiro na base: se a ordem fosse por criado_em, ela
    // ganharia. Quem decide é elegivel_em.
    const tarde = await criarEmpresa('0181')
    const cedo = await criarEmpresa('0270')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, elegivel_em, primeira_reserva_em)
       VALUES ($1, now() - interval '2 days',  now() - interval '32 days'),
              ($2, now() - interval '40 days', now() - interval '70 days')`,
      [tarde, cedo],
    )
    const [linha] = await puxar(vendedorA)
    expect(linha.empresa_id).toBe(cedo)
  })
})

describe('fila_puxar: o piso e a posse', () => {
  test('devolvida agora nao e elegivel', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, elegivel_em, primeira_reserva_em)
       VALUES ($1, now() + interval '30 days', now())`,
      [id],
    )
    expect(await puxar(vendedorA)).toEqual([])
  })

  test('empresa com dono ativo nao e elegivel', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, vendedorB],
    )
    expect(await puxar(vendedorA)).toEqual([])
  })

  test('reserva vigente de outro nao e elegivel', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql(
      `INSERT INTO empresa_fila (empresa_id, reservado_por, reservado_ate, primeira_reserva_em)
       VALUES ($1, $2, now() + interval '30 minutes', now())`,
      [id, vendedorB],
    )
    expect(await puxar(vendedorA)).toEqual([])
  })

  test('dono inativo volta a ser elegivel, e puxar limpa a posse', async () => {
    const id = await criarEmpresa('0181')
    await banco.sql(
      'INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em) VALUES ($1, $2, now())',
      [id, vendedorB],
    )
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [vendedorB])
    const [linha] = await puxar(vendedorA)
    expect(linha.empresa_id).toBe(id)
    const [estado] = await banco.sql<{ vendedor_id: string | null; reservado_por: string }>(
      'SELECT vendedor_id, reservado_por FROM empresa_fila WHERE empresa_id = $1',
      [id],
    )
    // Sem o `vendedor_id = NULL` no ON CONFLICT, o CHECK
    // empresa_fila_posse_ou_reserva recusaria a linha — e é bom que recuse.
    expect(estado).toEqual({ vendedor_id: null, reservado_por: vendedorA })
    await banco.sql('UPDATE usuario SET ativo = true WHERE id = $1', [vendedorB])
  })
})

describe('fila_puxar: SKIP LOCKED', () => {
  test('duas transacoes concorrentes recebem empresas DIFERENTES', async () => {
    const primeira = await criarEmpresa('0181')
    const segunda = await criarEmpresa('0270')
    const c1 = await conectarVerificado(banco.urlApp)
    const c2 = await conectarVerificado(banco.urlApp)
    try {
      // Duas conexões de verdade, as duas com transação aberta ao mesmo
      // tempo. Sem SKIP LOCKED, a segunda esperaria a primeira e as duas
      // sairiam com a MESMA empresa — dois vendedores ligando para o mesmo
      // comprador no mesmo minuto.
      for (const c of [c1, c2]) {
        await c.query('BEGIN')
        await c.query("SELECT set_config('role', 'app_usuario', true)")
      }
      await c1.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorA])
      await c2.query("SELECT set_config('app.usuario_id', $1, true)", [vendedorB])
      const r1 = await c1.query<{ empresa_id: string }>('SELECT empresa_id FROM fila_puxar()')
      const r2 = await c2.query<{ empresa_id: string }>('SELECT empresa_id FROM fila_puxar()')
      await c1.query('COMMIT')
      await c2.query('COMMIT')
      expect(r1.rows).toHaveLength(1)
      expect(r2.rows).toHaveLength(1)
      expect(r1.rows[0].empresa_id).not.toBe(r2.rows[0].empresa_id)
      expect([primeira, segunda].sort()).toEqual([r1.rows[0].empresa_id, r2.rows[0].empresa_id].sort())
    } finally {
      c1.release()
      c2.release()
    }
  })
})
