import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { LinhaAceita } from '@/src/features/empresas/planilha'
import { repositorioPostgres } from '@/src/features/empresas/repositorio'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string

const linha = (n: number, cnpj: string, extra: Partial<LinhaAceita> = {}): LinhaAceita => ({
  linha: n,
  cnpj,
  razaoSocial: 'Aurora Comercio LTDA',
  nomeFantasia: null,
  contatoNome: null,
  telefone: '11987654321',
  email: null,
  cep: null,
  ...extra,
})

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql(
    `INSERT INTO cep (cep, logradouro, faixa, bairro, localidade, uf, ibge)
     VALUES ('01310100', 'Avenida Paulista', 'lado ímpar', 'Bela Vista', 'São Paulo', 'SP', '3550308')`,
  )
  await banco.sql(
    `INSERT INTO cep_carga (fonte, versao, publicado_em, arquivo_sha256, linhas)
     VALUES ('opencep', '2.0.1', '2024-07-08', repeat('a', 64), 1209313)`,
  )
})
afterAll(async () => {
  await banco.derrubar()
})

describe('preparar', () => {
  test('devolve a data da base, os cnpjs ja cadastrados e os enderecos', async () => {
    const repo = repositorioPostgres(gestor)
    await repo.gravar([linha(2, '11222333000181')])
    const p = await repo.preparar(['11222333000181', '11444777000161'], ['01310100', '99999999'])
    if ('motivo' in p) throw new Error(p.motivo)
    expect([...p.jaCadastrados]).toEqual(['11222333000181'])
    expect(p.enderecos.get('01310100')?.localidade).toBe('São Paulo')
    expect(p.enderecos.has('99999999')).toBe(false)
    expect(p.basePublicadaEm).toBe('2024-07-08')
  })

  test('listas vazias nao vao ao banco atoa e nao quebram', async () => {
    const p = await repositorioPostgres(gestor).preparar([], [])
    if ('motivo' in p) throw new Error(p.motivo)
    expect(p.jaCadastrados.size).toBe(0)
    expect(p.enderecos.size).toBe(0)
  })

  test('vendedor nao ve empresa nem a data da base', async () => {
    const p = await repositorioPostgres(vendedor).preparar(['11222333000181'], [])
    if ('motivo' in p) throw new Error(p.motivo)
    expect(p.jaCadastrados.size).toBe(0)
    expect(p.basePublicadaEm).toBe(null)
  })
})

describe('gravar', () => {
  test('insere em lote e a auditoria registra o gestor', async () => {
    const r = await repositorioPostgres(gestor).gravar([
      linha(2, '11444777000161', { cep: '01310100' }),
      linha(3, '11555777000160', { nomeFantasia: 'Bela Luz', email: 'oi@bela.com.br' }),
    ])
    expect(r).toEqual({ ok: true, inseridas: 2 })
    const linhas = await banco.sql<{ cnpj: string; criado_por: string; cep: string | null }>(
      "SELECT cnpj, criado_por, cep FROM empresa WHERE cnpj IN ('11444777000161', '11555777000160') ORDER BY cnpj",
    )
    expect(linhas).toEqual([
      { cnpj: '11444777000161', criado_por: gestor, cep: '01310100' },
      { cnpj: '11555777000160', criado_por: gestor, cep: null },
    ])
  })

  test('lista vazia nao vai ao banco', async () => {
    expect(await repositorioPostgres(gestor).gravar([])).toEqual({ ok: true, inseridas: 0 })
  })

  test('vendedor recebe sem_permissao, nao excecao', async () => {
    const r = await repositorioPostgres(vendedor).gravar([linha(2, '11666777000169')])
    expect(r).toEqual({ ok: false, motivo: 'sem_permissao' })
  })

  test('tudo ou nada: cnpj repetido no lote nao grava nenhuma', async () => {
    const antes = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM empresa')
    await expect(
      repositorioPostgres(gestor).gravar([linha(2, '11777777000164'), linha(3, '11777777000164')]),
    ).rejects.toMatchObject({ code: '23505' })
    const depois = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM empresa')
    expect(depois[0].n).toBe(antes[0].n)
  })
})
