import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { conectarVerificado } from '@/src/server/db/pool'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string

const INSERIR = `INSERT INTO empresa (cnpj, razao_social, telefone)
                 VALUES ('11222333000181', 'Aurora Comercio LTDA', '11987654321')`

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
})
afterAll(async () => {
  await banco.derrubar()
})

describe('empresa: quem escreve', () => {
  test('gestor insere e a auditoria registra quem foi', async () => {
    const linhas = await banco.comoUsuario(gestor, async (e) => {
      await e(INSERIR)
      const r = await e<{ criado_por: string; cnpj: string }>('SELECT cnpj, criado_por FROM empresa')
      return r.linhas
    })
    expect(linhas).toEqual([{ cnpj: '11222333000181', criado_por: gestor }])
  })

  test('vendedor nao insere', async () => {
    await expect(banco.comoUsuario(vendedor, (e) => e(INSERIR))).rejects.toMatchObject({ code: '42501' })
  })

  test('vendedor nao le nenhuma linha', async () => {
    const r = await banco.comoUsuario(vendedor, (e) => e('SELECT cnpj FROM empresa'))
    expect(r.linhas).toEqual([])
  })

  test('app_conexao fora de comoUsuario e permission denied, nao zero linhas', async () => {
    const c = await conectarVerificado(banco.urlApp)
    try {
      await expect(c.query('SELECT cnpj FROM empresa')).rejects.toMatchObject({ code: '42501' })
    } finally {
      c.release()
    }
  })
})

describe('empresa: UPDATE e DELETE nao existem nesta fatia', () => {
  const escritas: [string, string][] = [
    ['UPDATE', "UPDATE empresa SET telefone = '11999999999'"],
    ['DELETE', 'DELETE FROM empresa'],
  ]
  for (const [verbo, sql] of escritas) {
    test(`${verbo} e 42501 por falta de GRANT`, async () => {
      await expect(banco.comoUsuario(gestor, (e) => e(sql))).rejects.toMatchObject({ code: '42501' })
    })
  }
})

describe('empresa: as restricoes', () => {
  const recusas: [string, string][] = [
    ['cnpj com 13 caracteres', "INSERT INTO empresa (cnpj, razao_social, telefone) VALUES ('1122233300018', 'X LTDA', '11987654321')"],
    ['cnpj com letra no digito verificador', "INSERT INTO empresa (cnpj, razao_social, telefone) VALUES ('112223330001A1', 'X LTDA', '11987654321')"],
    ['telefone com 9 digitos', "INSERT INTO empresa (cnpj, razao_social, telefone) VALUES ('11222333000182', 'X LTDA', '987654321')"],
    ['razao social so com espaco', "INSERT INTO empresa (cnpj, razao_social, telefone) VALUES ('11222333000183', '   ', '11987654321')"],
    ['nome fantasia vazio, que deveria ser NULL', "INSERT INTO empresa (cnpj, razao_social, nome_fantasia, telefone) VALUES ('11222333000184', 'X LTDA', '', '11987654321')"],
    ['email sem arroba', "INSERT INTO empresa (cnpj, razao_social, telefone, email) VALUES ('11222333000185', 'X LTDA', '11987654321', 'contato.exemplo.com')"],
    ['email com maiuscula', "INSERT INTO empresa (cnpj, razao_social, telefone, email) VALUES ('11222333000186', 'X LTDA', '11987654321', 'Contato@exemplo.com')"],
    ['numero sem cep', "INSERT INTO empresa (cnpj, razao_social, telefone, numero) VALUES ('11222333000187', 'X LTDA', '11987654321', '302')"],
  ]
  for (const [caso, sql] of recusas) {
    test(`recusa ${caso}`, async () => {
      await expect(banco.sql(sql)).rejects.toMatchObject({ code: '23514' })
    })
  }

  test('cnpj alfanumerico e aceito', async () => {
    await banco.sql("INSERT INTO empresa (cnpj, razao_social, telefone) VALUES ('AB12C3D40E9F45', 'Nova LTDA', '11987654321')")
    const r = await banco.sql<{ cnpj: string }>("SELECT cnpj FROM empresa WHERE cnpj = 'AB12C3D40E9F45'")
    expect(r).toHaveLength(1)
  })
})

describe('cep_carga: o relatorio pode ler a data da base', () => {
  beforeAll(async () => {
    await banco.sql(
      `INSERT INTO cep_carga (fonte, versao, publicado_em, arquivo_sha256, linhas)
       VALUES ('opencep', '2.0.1', '2024-07-08', repeat('a', 64), 1209313)`,
    )
  })

  test('gestor le', async () => {
    const r = await banco.comoUsuario(gestor, (e) => e<{ versao: string }>('SELECT versao FROM cep_carga'))
    expect(r.linhas).toEqual([{ versao: '2.0.1' }])
  })

  test('vendedor nao le', async () => {
    const r = await banco.comoUsuario(vendedor, (e) => e('SELECT versao FROM cep_carga'))
    expect(r.linhas).toEqual([])
  })
})
