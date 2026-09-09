import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { resolverCeps } from '@/src/server/cep/resolver'
import type { Executar } from '@/src/server/db/como-usuario'
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
  await banco.sql(
    `INSERT INTO cep (cep, logradouro, faixa, bairro, localidade, uf, ibge)
     VALUES ('69900001', NULL, NULL, NULL, 'Rio Branco', 'AC', '1200401')`,
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

// A 0014 concedeu SELECT em cep_carga a app_usuario, com política gestor-só,
// porque o relatório de importação cita a data da base. O vendedor continua
// sem ver — mas agora por RLS, e não por falta de GRANT. A diferença é
// observável: era 42501, virou zero linhas. Quem lê é conferido em
// tests/integracao/empresas.test.ts, que tem gestor.
describe('cep_carga: fora do alcance do vendedor', () => {
  test('SELECT devolve zero linhas, barrado pela política', async () => {
    const r = await banco.comoUsuario(vendedor, (e) => e('SELECT versao FROM cep_carga'))
    expect(r.linhas).toEqual([])
  })

  test('a dona lê: a tabela existe e o teste acima não passou por ausência', async () => {
    const r = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep_carga')
    expect(r).toEqual([{ n: '0' }])
  })
})

describe('resolverCeps', () => {
  test('traz o que existe e omite o que não existe, sem lançar', async () => {
    const mapa = await banco.comoUsuario(vendedor, (e) =>
      resolverCeps(e, ['01310100', '00000000', '69900001']),
    )
    expect(mapa.size).toBe(2)
    expect(mapa.get('01310100')).toEqual({
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      faixa: 'lado ímpar',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
      ibge: '3550308',
    })
    expect(mapa.get('00000000')).toBeUndefined()
  })

  test('CEP sem logradouro nem bairro volta com null, não com string vazia', async () => {
    const mapa = await banco.comoUsuario(vendedor, (e) => resolverCeps(e, ['69900001']))
    expect(mapa.get('69900001')).toMatchObject({ logradouro: null, faixa: null, bairro: null })
  })

  test('uma consulta só, não uma por CEP', async () => {
    let idas = 0
    // Um cast só, no ponto onde a função concreta encontra a assinatura
    // genérica de Executar. Espalhar `as never` pelos argumentos esconderia
    // erro de tipo de verdade.
    const espiao = (async (sql: string, params?: unknown[]) => {
      idas++
      return banco.comoUsuario(vendedor, (e) => e(sql, params))
    }) as Executar
    await resolverCeps(espiao, ['01310100', '69900001', '00000000'])
    expect(idas).toBe(1)
  })

  test('lista vazia nem chega a consultar', async () => {
    let idas = 0
    const espiao = (async (sql: string, params?: unknown[]) => {
      idas++
      return banco.comoUsuario(vendedor, (e) => e(sql, params))
    }) as Executar
    const mapa = await resolverCeps(espiao, [])
    expect(mapa.size).toBe(0)
    expect(idas).toBe(0)
  })
})
