import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { lerHistorico } from '@/src/features/contato/historico'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedorA: string
let vendedorB: string
let empresa: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
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

beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
})

// `definir_auditoria` sobrescreve criado_em E criado_por no INSERT
// (0003_auditoria.sql:8-9), então contato semeado por `banco.sql` nasce sem
// autor e com o now() da transação da semeadura. Teste que dependa de autor ou
// de ordem no tempo tem que escrever pelo caminho de verdade, em transações
// separadas — é o que dá dois now() diferentes.
function registrar(usuarioId: string, nota: string): Promise<string> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<{ contato_registrar: string }>(
      'SELECT contato_registrar($1, $2, $3, NULL, NULL, $4)',
      [empresa, 'acompanhamento', nota, 'nenhum'],
    )
    return r.linhas[0].contato_registrar
  })
}

async function darPosseA(usuarioId: string): Promise<void> {
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em)
     VALUES ($1, $2, now())
     ON CONFLICT (empresa_id) DO UPDATE
        SET vendedor_id = excluded.vendedor_id, reservado_por = NULL, reservado_ate = NULL`,
    [empresa, usuarioId],
  )
}

describe('lerHistorico', () => {
  test('empresa sem contato devolve lista vazia, e nao falha', async () => {
    await darPosseA(vendedorA)
    const r = await lerHistorico(vendedorA, empresa)
    expect(r).toEqual({ ok: true, contatos: [] })
  })

  test('devolve do mais recente para tras, com o nome do autor', async () => {
    await darPosseA(vendedorA)
    expect(await registrar(vendedorA, 'primeiro')).toBe('ok')
    expect(await registrar(vendedorA, 'segundo')).toBe('ok')
    const r = await lerHistorico(vendedorA, empresa)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.contatos.map((c) => c.nota)).toEqual(['segundo', 'primeiro'])
    expect(r.contatos[0].autor).toBe('VendedorA')
  })

  test('proximo passo vem como texto YYYY-MM-DD, sem ambiguidade de Date', async () => {
    await darPosseA(vendedorA)
    await banco.comoUsuario(vendedorA, (e) =>
      e('SELECT contato_registrar($1, $2, NULL, $3, $4, $5)', [
        empresa,
        'acompanhamento',
        'Mandar orcamento',
        '2026-10-01',
        'nenhum',
      ]),
    )
    const r = await lerHistorico(vendedorA, empresa)
    if (!r.ok) throw new Error('esperava sucesso')
    expect(r.contatos[0].proximoPassoData).toBe('2026-10-01')
  })

  test('quem nao esta com a empresa recebe lista vazia pela RLS, nao erro', async () => {
    await darPosseA(vendedorA)
    await banco.sql('INSERT INTO contato (empresa_id, tipo, criado_por) VALUES ($1, $2, $3)', [
      empresa,
      'nao_atendeu',
      vendedorA,
    ])
    const r = await lerHistorico(vendedorB, empresa)
    expect(r).toEqual({ ok: true, contatos: [] })
  })
})
