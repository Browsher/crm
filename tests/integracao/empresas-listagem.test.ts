import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { lerConsulta, POR_PAGINA } from '@/src/features/empresas/consulta'
import { listarEmpresas } from '@/src/features/empresas/listagem'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let gestor: string
let vendedor: string

// O CHECK da 0014 exige a forma de 14 caracteres, não o dígito verificador —
// quem confere o DV é a importação. Um CNPJ por índice basta aqui.
function cnpjDe(i: number): string {
  return `1122233300${String(i).padStart(4, '0')}`
}

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  gestor = await criarUsuario(banco, 'gestor', 'Gestor')
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql(
    "INSERT INTO cep (cep, localidade, uf, ibge) VALUES ('01310100', 'São Paulo', 'SP', '3550308')",
  )
  await banco.sql(
    `INSERT INTO empresa (cnpj, razao_social, nome_fantasia, telefone, cep)
     VALUES ($1, 'Iluminação São João', 'LÂMPADAS Ltda', '11987654321', '01310100'),
            ($2, 'Beta Comercio', NULL, '1133334444', '99999999'),
            ($3, 'Gama 100% Luz', NULL, '1133335555', NULL)`,
    [cnpjDe(1), cnpjDe(2), cnpjDe(3)],
  )
})
afterAll(async () => {
  await banco.derrubar()
})

describe('listarEmpresas: busca', () => {
  test('sem termo, traz todas, em ordem de razão social', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({}))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.total).toBe(3)
    expect(r.linhas.map((l) => l.razaoSocial)).toEqual([
      'Beta Comercio',
      'Gama 100% Luz',
      'Iluminação São João',
    ])
  })

  test('acha "São" digitando "sao joao", sem acento e em minúscula', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: 'sao joao' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas.map((l) => l.razaoSocial)).toEqual(['Iluminação São João'])
  })

  test('acha pelo nome fantasia acentuado', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: 'lampadas' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.total).toBe(1)
  })

  test('CNPJ inteiro acha a empresa', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: '11.222.333/0000-01' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas.map((l) => l.cnpj)).toEqual([cnpjDe(1)])
  })

  // O motivo de busca não conter o CNPJ: pedaço de CNPJ casaria empresa
  // nenhuma a ver, e casaria diferente conforme o nome fantasia da vizinha.
  test('pedaço de CNPJ não acha ninguém', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: '1122' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.total).toBe(0)
  })

  test('% digitado é literal, não coringa', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: '100%' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas.map((l) => l.razaoSocial)).toEqual(['Gama 100% Luz'])
  })

  test('_ digitado é literal, não coringa', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: '_' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.total).toBe(0)
  })
})

describe('listarEmpresas: endereço', () => {
  test('CEP resolvido traz cidade e UF', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: 'sao joao' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas[0]).toMatchObject({ cep: '01310100', localidade: 'São Paulo', uf: 'SP' })
  })

  // Os três estados são diferentes na tela, então são diferentes aqui.
  test('CEP não encontrado na base: o CEP fica, cidade e UF vêm nulas', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: 'beta' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas[0]).toMatchObject({ cep: '99999999', localidade: null, uf: null })
  })

  test('empresa sem CEP: os três nulos', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ q: 'gama' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas[0]).toMatchObject({ cep: null, localidade: null, uf: null })
  })
})

describe('listarEmpresas: paginação', () => {
  // Razão social repetida de propósito: sem desempate por id, a ordem entre
  // linhas iguais fica indefinida e a página 2 repete ou pula.
  beforeAll(async () => {
    const cnpjs = Array.from({ length: POR_PAGINA + 5 }, (_, i) => cnpjDe(i + 10))
    await banco.sql(
      `INSERT INTO empresa (cnpj, razao_social, telefone)
       SELECT unnest($1::text[]), 'Zeta Repetida', '1133330000'`,
      [cnpjs],
    )
  })

  test('a primeira página traz POR_PAGINA linhas e o total de todas', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({}))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas).toHaveLength(POR_PAGINA)
    expect(r.total).toBe(POR_PAGINA + 8)
  })

  test('a segunda página não repete nem pula linha da primeira', async () => {
    const um = await listarEmpresas(gestor, lerConsulta({ pagina: '1' }))
    const dois = await listarEmpresas(gestor, lerConsulta({ pagina: '2' }))
    if (!um.ok || !dois.ok) throw new Error('listagem falhou')
    const ids = [...um.linhas, ...dois.linhas].map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(POR_PAGINA + 8)
  })

  test('página além do fim vem vazia, sem erro', async () => {
    const r = await listarEmpresas(gestor, lerConsulta({ pagina: '99' }))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.linhas).toEqual([])
  })
})

describe('listarEmpresas: quem pode ler', () => {
  // A política é gestor-só nesta fatia, porque não há posse para mascarar.
  // Vendedor não recebe erro: recebe nenhuma linha, que é o que a RLS faz.
  test('vendedor não vê empresa nenhuma', async () => {
    const r = await listarEmpresas(vendedor, lerConsulta({}))
    if (!r.ok) throw new Error(r.motivo)
    expect(r.total).toBe(0)
  })
})
