import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql(
    `INSERT INTO cep (cep, logradouro, faixa, bairro, localidade, uf, ibge)
     VALUES ('01310100', 'Avenida Paulista', 'lado ímpar', 'Bela Vista', 'São Paulo', 'SP', '3550308')`,
  )
})
afterAll(async () => {
  await banco.derrubar()
})

describe('cep: leitura', () => {
  test('qualquer autenticado lê, inclusive vendedor', async () => {
    const linhas = await banco.comoUsuario(vendedor, async (e) => {
      const r = await e<{ localidade: string }>('SELECT localidade FROM cep WHERE cep = $1', ['01310100'])
      return r.linhas
    })
    expect(linhas).toEqual([{ localidade: 'São Paulo' }])
  })

  test('app_conexao fora de comoUsuario é permission denied, não zero linhas', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      await expect(c.query('SELECT cep FROM cep')).rejects.toMatchObject({ code: '42501' })
    } finally {
      c.release()
    }
  })
})

describe('cep: ninguém escreve pela aplicação', () => {
  const escritas: [string, string][] = [
    ['INSERT', "INSERT INTO cep (cep, localidade, uf, ibge) VALUES ('99999999', 'X', 'SP', '3550308')"],
    ['UPDATE', "UPDATE cep SET localidade = 'X' WHERE cep = '01310100'"],
    ['DELETE', "DELETE FROM cep WHERE cep = '01310100'"],
  ]
  for (const [verbo, sql] of escritas) {
    test(`${verbo} é 42501 por falta de GRANT`, async () => {
      await expect(banco.comoUsuario(vendedor, (e) => e(sql))).rejects.toMatchObject({ code: '42501' })
    })
  }
})

describe('cep_carga: inalcançável pela aplicação', () => {
  test('SELECT é 42501', async () => {
    await expect(
      banco.comoUsuario(vendedor, (e) => e('SELECT versao FROM cep_carga')),
    ).rejects.toMatchObject({ code: '42501' })
  })

  test('a dona lê: a tabela existe e o teste acima não passou por ausência', async () => {
    const r = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep_carga')
    expect(r).toEqual([{ n: '0' }])
  })
})
