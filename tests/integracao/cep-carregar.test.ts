import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { carregar } from '@/src/server/cep/carregar'
import type { LinhaCep } from '@/src/server/cep/linha'
import { somaDoArquivo, type Manifesto } from '@/src/server/cep/manifesto'
import { lerZip } from '@/src/server/cep/zip'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'

const FIXTURE = 'tests/fixtures/cep-mini.zip'

let banco: BancoDeTeste
let manifesto: Manifesto

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  manifesto = {
    fonte: 'fixture',
    versao: 'mini',
    publicado_em: '2024-07-08',
    url: 'file://tests/fixtures/cep-mini.zip',
    // A soma é calculada aqui, não colada: o zip é construído localmente e o
    // valor mudaria a cada reconstrução. O caminho vermelho usa soma errada.
    sha256: await somaDoArquivo(FIXTURE),
    linhas_esperadas: 11,
  }
})
afterAll(async () => {
  await banco.derrubar()
})

describe('lerZip', () => {
  test('lê as doze entradas, inclusive a repetida', async () => {
    const lidas: LinhaCep[] = []
    const r = await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(r).toEqual({ lidas: 12, descartadas: 0 })
    expect(lidas).toHaveLength(12)
    expect(new Set(lidas.map((l) => l.cep)).size).toBe(11)
  })

  test('traduz complemento em faixa e vazio em null', async () => {
    const lidas: LinhaCep[] = []
    await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(lidas.find((l) => l.cep === '01001000')).toMatchObject({ faixa: 'lado par' })
    expect(lidas.find((l) => l.cep === '69900001')).toMatchObject({
      logradouro: null,
      faixa: null,
      bairro: null,
      localidade: 'Rio Branco',
    })
  })

  test('acento sobrevive: o arquivo é UTF-8', async () => {
    const lidas: LinhaCep[] = []
    await lerZip(FIXTURE, (l) => lidas.push(l))
    expect(lidas.find((l) => l.cep === '88010000')?.localidade).toBe('Florianópolis')
  })

  test('zip inexistente rejeita, não devolve zero linhas', async () => {
    await expect(lerZip('tests/fixtures/nao-existe.zip', () => {})).rejects.toThrow()
  })
})

describe('carregar', () => {
  test('carrega o fixture, deduplica e grava o retrato', async () => {
    const r = await carregar({ urlAdmin: banco.urlAdmin, caminhoZip: FIXTURE, manifesto })
    expect(r).toEqual({ ok: true, linhas: 11 })

    const linhas = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep')
    expect(linhas).toEqual([{ n: '11' }])

    const carga = await banco.sql<{ fonte: string; versao: string; linhas: number }>(
      'SELECT fonte, versao, linhas FROM cep_carga',
    )
    expect(carga).toEqual([{ fonte: 'fixture', versao: 'mini', linhas: 11 }])
  })

  test('a duplicata não aborta a carga: 12 entradas viram 11 linhas', async () => {
    const r = await banco.sql<{ n: string }>("SELECT count(*)::text AS n FROM cep WHERE cep = '01310100'")
    expect(r).toEqual([{ n: '1' }])
  })

  test('vírgula e aspas atravessam o CSV sem estragar a linha', async () => {
    const r = await banco.sql<{ logradouro: string }>(
      "SELECT logradouro FROM cep WHERE cep IN ('30130000', '40020000') ORDER BY cep",
    )
    expect(r).toEqual([
      { logradouro: 'Avenida Afonso Pena, lado ímpar' },
      { logradouro: 'Praça da "Sé" Velha' },
    ])
  })

  test('carregar de novo substitui o retrato inteiro, sem duplicar', async () => {
    await carregar({ urlAdmin: banco.urlAdmin, caminhoZip: FIXTURE, manifesto })
    const linhas = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep')
    expect(linhas).toEqual([{ n: '11' }])
    const cargas = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep_carga')
    expect(cargas).toEqual([{ n: '2' }])
  })

  test('soma diferente para antes de tocar no banco', async () => {
    const errado = { ...manifesto, sha256: '0'.repeat(64) }
    const r = await carregar({ urlAdmin: banco.urlAdmin, caminhoZip: FIXTURE, manifesto: errado })
    expect(r).toMatchObject({ ok: false, motivo: 'soma_diferente' })
    const linhas = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep')
    expect(linhas).toEqual([{ n: '11' }])
  })

  test('contagem diferente faz ROLLBACK e o retrato anterior sobrevive', async () => {
    const errado = { ...manifesto, versao: 'quebrada', linhas_esperadas: 999 }
    const r = await carregar({ urlAdmin: banco.urlAdmin, caminhoZip: FIXTURE, manifesto: errado })
    expect(r).toMatchObject({ ok: false, motivo: 'contagem_diferente' })
    const linhas = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM cep')
    expect(linhas).toEqual([{ n: '11' }])
    const quebrada = await banco.sql<{ n: string }>(
      "SELECT count(*)::text AS n FROM cep_carga WHERE versao = 'quebrada'",
    )
    expect(quebrada).toEqual([{ n: '0' }])
  })

  // Este roda por último de propósito: ele acrescenta uma linha em cep_carga, e
  // os testes acima contam essa tabela.
  test('avisa fase e progresso, para o operador distinguir trabalhando de travado', async () => {
    const lidas: number[] = []
    const fases: string[] = []
    const r = await carregar({
      urlAdmin: banco.urlAdmin,
      caminhoZip: FIXTURE,
      manifesto,
      aoProgredir: (n) => lidas.push(n),
      aoFase: (f) => fases.push(f),
    })
    expect(r).toEqual({ ok: true, linhas: 11 })
    // Doze avisos, um por ENTRADA do zip — não por linha gravada. A duplicata
    // é lida e contada; quem a descarta é o DISTINCT ON, depois.
    expect(lidas).toHaveLength(12)
    expect(lidas.at(-1)).toBe(12)
    expect(fases).toEqual(['conferindo soma', 'lendo zip', 'gravando no banco'])
  })

  test('a fase para na soma errada: não anuncia leitura nem gravação', async () => {
    const fases: string[] = []
    const errado = { ...manifesto, sha256: '0'.repeat(64) }
    await carregar({ urlAdmin: banco.urlAdmin, caminhoZip: FIXTURE, manifesto: errado, aoFase: (f) => fases.push(f) })
    expect(fases).toEqual(['conferindo soma'])
  })
})
