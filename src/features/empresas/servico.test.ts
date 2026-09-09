import { describe, expect, test } from 'vitest'
import type { Endereco } from '../../server/cep/resolver'
import { CABECALHO, type LinhaAceita } from './planilha'
import type { RepositorioEmpresas } from './repositorio'
import { analisar, importar } from './servico'

const endereco: Endereco = {
  cep: '01310100',
  logradouro: 'Avenida Paulista',
  faixa: null,
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
  ibge: '3550308',
}

function repoFalso(jaCadastrados: string[] = [], opcoes: { semBase?: boolean } = {}) {
  const gravadas: LinhaAceita[][] = []
  const repo: RepositorioEmpresas = {
    async preparar() {
      // semBase: cep_carga vazia E cep vazia, que é como um ambiente novo
      // nasce — a Railway inclusive, enquanto a carga não roda lá.
      return {
        jaCadastrados: new Set(jaCadastrados),
        enderecos: opcoes.semBase ? new Map() : new Map([['01310100', endereco]]),
        basePublicadaEm: opcoes.semBase ? null : '2024-07-08',
      }
    },
    async gravar(linhas) {
      gravadas.push(linhas)
      return { ok: true, inseridas: linhas.length }
    },
  }
  return { repo, gravadas }
}

const bytes = (...linhas: string[]) => new TextEncoder().encode([CABECALHO, ...linhas].join('\n'))
const AURORA = '11222333000181,Aurora Comercio LTDA,,,11987654321,,01310100'
const BELA = '11444777000161,Bela Luz LTDA,,,1134567890,,'
const SEM_CEP_NA_BASE = '11555777000139,Nova LTDA,,,1134567891,,99999999'

describe('analisar', () => {
  test('conta novas, ja cadastradas e ceps nao encontrados', async () => {
    const { repo, gravadas } = repoFalso(['11444777000161'])
    const r = await analisar(repo, bytes(AURORA, BELA, SEM_CEP_NA_BASE))
    expect(r).toEqual({
      ok: true,
      relatorio: {
        novas: 2,
        jaCadastradas: 1,
        recusadas: [],
        cepsPedidos: 2,
        cepsNaoEncontrados: 1,
        basePublicadaEm: '2024-07-08',
      },
    })
    expect(gravadas).toEqual([])
  })

  test('nao grava nada, nem quando esta tudo certo', async () => {
    const { repo, gravadas } = repoFalso()
    await analisar(repo, bytes(AURORA))
    expect(gravadas).toEqual([])
  })

  test('arquivo invalido devolve a falha do arquivo', async () => {
    const { repo } = repoFalso()
    const r = await analisar(repo, new TextEncoder().encode('cnpj,nome\n1,2'))
    expect(r).toEqual({
      ok: false,
      motivo: 'arquivo_invalido',
      falha: { motivo: 'cabecalho_diferente', encontrado: 'cnpj,nome' },
    })
  })

  test('recusa de linha entra no relatorio sem impedir o resto', async () => {
    const { repo } = repoFalso()
    const r = await analisar(repo, bytes(AURORA, '11222333000182,Erro LTDA,,,11987654321,,'))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.novas).toBe(1)
    expect(r.relatorio.recusadas).toEqual([{ tipo: 'campo', linha: 3, motivo: 'cnpj_dv', valor: '11222333000182' }])
  })

  test('sem_permissao do repositorio sobe como esta', async () => {
    const repo: RepositorioEmpresas = {
      async preparar() {
        return { ok: false, motivo: 'sem_permissao' }
      },
      async gravar() {
        return { ok: false, motivo: 'sem_permissao' }
      },
    }
    expect(await analisar(repo, bytes(AURORA))).toEqual({ ok: false, motivo: 'sem_permissao' })
  })
})

describe('analisar: a base de CEP nao carregada', () => {
  test('basePublicadaEm nulo e todos os ceps pedidos sem resposta', async () => {
    const { repo } = repoFalso([], { semBase: true })
    const r = await analisar(repo, bytes(AURORA, SEM_CEP_NA_BASE))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.basePublicadaEm).toBe(null)
    expect(r.relatorio.cepsPedidos).toBe(2)
    expect(r.relatorio.cepsNaoEncontrados).toBe(2)
  })

  test('cepsPedidos conta CEP distinto, nao linha', async () => {
    const { repo } = repoFalso()
    const outra = '11444777000161,Bela Luz LTDA,,,1134567890,,01310100'
    const r = await analisar(repo, bytes(AURORA, outra))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.cepsPedidos).toBe(1)
  })

  test('arquivo sem nenhum CEP pede zero', async () => {
    const { repo } = repoFalso([], { semBase: true })
    const r = await analisar(repo, bytes(BELA))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.cepsPedidos).toBe(0)
  })
})

describe('importar', () => {
  test('grava so as novas, nunca as ja cadastradas', async () => {
    const { repo, gravadas } = repoFalso(['11444777000161'])
    const r = await importar(repo, bytes(AURORA, BELA))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.inseridas).toBe(1)
    expect(gravadas[0].map((l) => l.cnpj)).toEqual(['11222333000181'])
  })

  test('o relatorio devolvido e o mesmo que analisar daria', async () => {
    const { repo } = repoFalso(['11444777000161'])
    const analise = await analisar(repo, bytes(AURORA, BELA))
    const importacao = await importar(repo, bytes(AURORA, BELA))
    if (!analise.ok || !importacao.ok) throw new Error('esperava ok nos dois')
    expect(importacao.relatorio).toEqual(analise.relatorio)
  })
})
