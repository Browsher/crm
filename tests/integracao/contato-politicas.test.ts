import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
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

beforeEach(async () => {
  await banco.sql('DELETE FROM contato')
  await banco.sql('DELETE FROM empresa_fila')
})

// Cenário escrito como dona: a RLS não vale aqui, e é isso que faz disto
// preparação e não exercício do desenho.
async function contatoDe(autor: string, tipo = 'nao_atendeu'): Promise<string> {
  const [linha] = await banco.sql<{ id: string }>(
    'INSERT INTO contato (empresa_id, tipo, criado_por) VALUES ($1, $2, $3) RETURNING id',
    [empresa, tipo, autor],
  )
  return linha.id
}

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

async function darPosseA(usuarioId: string): Promise<void> {
  await banco.sql(
    `INSERT INTO empresa_fila (empresa_id, vendedor_id, primeira_reserva_em)
     VALUES ($1, $2, now())
     ON CONFLICT (empresa_id) DO UPDATE
        SET vendedor_id = excluded.vendedor_id, reservado_por = NULL, reservado_ate = NULL`,
    [empresa, usuarioId],
  )
}

function lerContatos(usuarioId: string): Promise<{ id: string }[]> {
  return banco.comoUsuario(usuarioId, async (e) => {
    const r = await e<{ id: string }>('SELECT id FROM contato')
    return r.linhas
  })
}

describe('contato: privilégios', () => {
  test('app_teste fora de comoUsuario e 42501, nao zero linhas', async () => {
    await contatoDe(vendedorA)
    const c = await conectarVerificado(banco.urlApp)
    try {
      await expect(c.query('SELECT id FROM contato')).rejects.toMatchObject({ code: '42501' })
    } finally {
      c.release()
    }
  })

  // A imutabilidade da tabela é por AUSÊNCIA de função de escrita. Ausência
  // não é verificável olhando o código: precisa destes três.
  const escritas: [string, string][] = [
    ['INSERT', "INSERT INTO contato (empresa_id, tipo) VALUES ('11111111-1111-4111-8111-111111111111', 'x')"],
    ['UPDATE', "UPDATE contato SET nota = 'alterada'"],
    ['DELETE', 'DELETE FROM contato'],
  ]
  for (const [verbo, sql] of escritas) {
    test(`${verbo} e 42501 por falta de GRANT, inclusive para o gestor`, async () => {
      await expect(banco.comoUsuario(gestor, (e) => e(sql))).rejects.toMatchObject({ code: '42501' })
    })
  }
})

describe('contato_leitura: segue a empresa, nao o autor', () => {
  test('vendedor com posse le os contatos da empresa', async () => {
    await contatoDe(vendedorA)
    await darPosseA(vendedorA)
    expect(await lerContatos(vendedorA)).toHaveLength(1)
  })

  test('vendedor com reserva vigente le os contatos da empresa', async () => {
    await contatoDe(vendedorA)
    await reservarPara(vendedorA)
    expect(await lerContatos(vendedorA)).toHaveLength(1)
  })

  test('vendedor sem a empresa NAO le contato nenhum', async () => {
    await contatoDe(vendedorA)
    await darPosseA(vendedorA)
    expect(await lerContatos(vendedorB)).toEqual([])
  })

  // O propósito da fatia inteira: o histórico atravessa a troca de dono.
  test('vendedor B, ao ficar com a empresa, le o contato escrito por A', async () => {
    await contatoDe(vendedorA)
    await reservarPara(vendedorB)
    expect(await lerContatos(vendedorB)).toHaveLength(1)
  })

  // Decidido, não defeito: a política segue a empresa. É a fragilidade desta
  // fatia com mais chance de virar reclamação — o vendedor devolve uma
  // empresa, lembra que anotou algo importante, e não consegue mais ver.
  test('o AUTOR deixa de ler o proprio contato quando a empresa sai da mao dele', async () => {
    await contatoDe(vendedorA)
    await darPosseA(vendedorB)
    expect(await lerContatos(vendedorA)).toEqual([])
  })

  test('reserva expirada nao da leitura', async () => {
    await contatoDe(vendedorA)
    await reservarPara(vendedorA, -1)
    expect(await lerContatos(vendedorA)).toEqual([])
  })

  test('gestor le tudo, sem posse nenhuma', async () => {
    await contatoDe(vendedorA)
    expect(await lerContatos(gestor)).toHaveLength(1)
  })
})

// Quem PEGA o estreitamento é o teste de comportamento acima, em `contato`.
// Quem EXPLICA é este: nomeado pela dependência, ele falha junto e diz de qual
// tabela veio a causa. Sozinho, o primeiro acusa `contato` quando o problema
// está em `empresa_leitura` ou em `empresa_fila_leitura`.
describe('contato_leitura depende de empresa_leitura, que depende de empresa_fila_leitura', () => {
  test('a empresa reservada e visivel para o vendedor, e e disso que contato_leitura vive', async () => {
    await reservarPara(vendedorA)
    const linhas = await banco.comoUsuario(vendedorA, async (e) => {
      const r = await e<{ id: string }>('SELECT id FROM empresa')
      return r.linhas
    })
    expect(linhas).toHaveLength(1)
  })
})

describe('contato_proximo_passo_coerente', () => {
  test('passo sem data e recusado', async () => {
    await expect(
      banco.sql("INSERT INTO contato (empresa_id, tipo, proximo_passo) VALUES ($1, 'acompanhamento', 'ligar')", [
        empresa,
      ]),
    ).rejects.toMatchObject({ code: '23514' })
  })

  test('data sem passo e recusada', async () => {
    await expect(
      banco.sql(
        "INSERT INTO contato (empresa_id, tipo, proximo_passo_data) VALUES ($1, 'acompanhamento', '2026-10-01')",
        [empresa],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

// A revogação. É este teste que impede o GRANT de voltar por descuido numa
// migração futura: a ausência do privilégio não é observável no código.
describe('empresa_assumir e empresa_devolver sao internas', () => {
  const internas: [string, string][] = [
    ['empresa_assumir', 'SELECT empresa_assumir($1)'],
    ['empresa_devolver', 'SELECT empresa_devolver($1)'],
  ]
  for (const [nome, sql] of internas) {
    test(`${nome} chamada direto por app_usuario e 42501`, async () => {
      await expect(banco.comoUsuario(vendedorA, (e) => e(sql, [empresa]))).rejects.toMatchObject({ code: '42501' })
    })
  }
})

// `usuario_publico` contorna a RLS de `usuario` POR DESENHO: view sem
// `security_invoker` roda como a dona, que é dona da tabela e não sofre RLS
// (a tabela não tem FORCE). É o que faz o nome do autor atravessar a troca de
// dono. O preço é que a view precisa expor o mínimo, e isso tem teste.
describe('usuario_publico expõe id e nome, e nada mais', () => {
  test('vendedor le o nome de OUTRO usuario', async () => {
    const nomes = await banco.comoUsuario(vendedorA, async (e) => {
      const r = await e<{ nome: string }>('SELECT nome FROM usuario_publico ORDER BY nome')
      return r.linhas.map((l) => l.nome)
    })
    expect(nomes).toContain('VendedorB')
  })

  const escondidas: string[] = ['email', 'papel', 'ativo', 'senha_provisoria_pendente']
  for (const coluna of escondidas) {
    test(`${coluna} nao existe na view`, async () => {
      await expect(
        banco.comoUsuario(vendedorA, (e) => e(`SELECT ${coluna} FROM usuario_publico`)),
      ).rejects.toMatchObject({ code: '42703' })
    })
  }

  test('a tabela usuario continua fechada: o vendedor nao le a linha de outro', async () => {
    const linhas = await banco.comoUsuario(vendedorA, async (e) => {
      const r = await e<{ nome: string }>('SELECT nome FROM usuario')
      return r.linhas.map((l) => l.nome)
    })
    expect(linhas).toEqual(['VendedorA'])
  })
})
