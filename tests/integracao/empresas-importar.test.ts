import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { LinhaAceita } from '@/src/features/empresas/planilha'
import { CABECALHO_LEGADO } from '@/src/features/empresas/planilha'
import { repositorioPostgres, type OperacaoGrupo } from '@/src/features/empresas/repositorio'
import { analisar, importar, type Relatorio } from '@/src/features/empresas/servico'
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
  cnaePrincipal: null,
  ...extra,
})

const relatorio = (novas: number, jaCadastradas = 0): Relatorio => ({
  novas,
  jaCadastradas,
  recusadas: [],
  cepsPedidos: 0,
  cepsNaoEncontrados: 0,
  basePublicadaEm: '2024-07-08',
})

const operacao = (nome = 'Mooca', chave = randomUUID()): OperacaoGrupo => ({
  chave,
  nome,
  arquivoNome: `${nome.toLocaleLowerCase('pt-BR')}.csv`,
  assinatura: 'a'.repeat(64),
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
    await banco.sql(
      `INSERT INTO empresa (cnpj, razao_social, telefone)
       VALUES ('11222333000181', 'Aurora Comercio LTDA', '11987654321')`,
    )
    const p = await repo.preparar(['11222333000181', '11444777000161'], ['01310100', '00000000'])
    if ('motivo' in p) throw new Error(p.motivo)
    expect([...p.jaCadastrados]).toEqual(['11222333000181'])
    expect(p.enderecos.get('01310100')?.localidade).toBe('São Paulo')
    expect(p.enderecos.has('00000000')).toBe(false)
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
  test('confirma grupo, insere em lote e registra o gestor', async () => {
    const r = await repositorioPostgres(gestor).gravar(operacao(), [
      linha(2, '11444777000161', { cep: '01310100' }),
      linha(3, '11555777000160', { nomeFantasia: 'Bela Luz', email: 'oi@bela.com.br' }),
    ], relatorio(2))
    expect(r).toMatchObject({ ok: true, inseridas: 2, vinculadas: 2, relatorio: relatorio(2) })
    const linhas = await banco.sql<{ cnpj: string; criado_por: string; cep: string | null }>(
      "SELECT cnpj, criado_por, cep FROM empresa WHERE cnpj IN ('11444777000161', '11555777000160') ORDER BY cnpj",
    )
    expect(linhas).toEqual([
      { cnpj: '11444777000161', criado_por: gestor, cep: '01310100' },
      { cnpj: '11555777000160', criado_por: gestor, cep: null },
    ])
  })

  test('vendedor recebe sem_permissao, nao excecao', async () => {
    const r = await repositorioPostgres(vendedor).gravar(operacao(), [linha(2, '11666777000169')], relatorio(1))
    expect(r).toEqual({ ok: false, motivo: 'sem_permissao' })
  })

  test('cnpj repetido no pedido: devolve confirmacao_invalida e nao grava nenhuma', async () => {
    const antes = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM empresa')
    const r = await repositorioPostgres(gestor).gravar(
      operacao(),
      [linha(2, '11777777000183'), linha(3, '11777777000183')],
      relatorio(2),
    )
    expect(r).toEqual({ ok: false, motivo: 'confirmacao_invalida' })
    const depois = await banco.sql<{ n: string }>('SELECT count(*)::text AS n FROM empresa')
    expect(depois[0].n).toBe(antes[0].n)
  })

  test('CNPJ existente e novo entram juntos no grupo sem sobrescrever o existente', async () => {
    const repo = repositorioPostgres(gestor)
    const existente = linha(2, '11666777000106', { razaoSocial: 'Original LTDA' })
    expect(await repo.gravar(operacao('Primeiro'), [existente], relatorio(1))).toMatchObject({ ok: true, inseridas: 1 })
    const r = await repo.gravar(
      operacao('Segundo'),
      [linha(2, '11666777000106', { razaoSocial: 'Tentativa de troca LTDA' }), linha(3, '11888777000150')],
      relatorio(1, 1),
    )
    expect(r).toMatchObject({ ok: true, inseridas: 1, vinculadas: 2 })
    expect(await banco.sql<{ razao_social: string }>(
      "SELECT razao_social FROM empresa WHERE cnpj = '11666777000106'",
    )).toEqual([{ razao_social: 'Original LTDA' }])
  })
})

describe('importar: confirmação idempotente', () => {
  const csv = (...linhas: string[]) => new TextEncoder().encode([CABECALHO_LEGADO, ...linhas].join('\n'))
  const duas = csv(
    '11222333000262,Replay Um LTDA,,,1134567801,,',
    '11222333000343,Replay Dois LTDA,,,1134567802,,',
  )

  test('retry após o primeiro commit devolve grupo, contagens e relatório originais', async () => {
    const repo = repositorioPostgres(gestor)
    const op = operacao('Replay')
    const primeira = await importar(repo, duas, op)
    const segunda = await importar(repo, duas, op)

    if (!primeira.ok || !segunda.ok) throw new Error('esperava duas confirmações válidas')
    expect(primeira.relatorio).toMatchObject({ novas: 2, jaCadastradas: 0 })
    expect(segunda).toEqual(primeira)
    expect(await banco.sql<{ n: string }>(
      'SELECT count(*)::text AS n FROM grupo_importacao WHERE chave = $1',
      [op.chave],
    )).toEqual([{ n: '1' }])
  })

  test('arquivo somente com existentes ainda cria grupo e vínculos', async () => {
    const r = await importar(repositorioPostgres(gestor), duas, operacao('Somente existentes'))
    expect(r).toMatchObject({ ok: true, inseridas: 0, vinculadas: 2 })
  })
})

// O estado em que um banco novo nasce, e em que a Railway está enquanto a carga
// não roda lá: cep_carga vazia. Vale ter contra o banco de verdade, e não só
// contra repositório de mentira, porque o que responde é uma consulta SQL.
describe('preparar: base de CEP nunca carregada', () => {
  test('basePublicadaEm vem nulo quando cep_carga esta vazia', async () => {
    const guardadas = await banco.sql<Record<string, unknown>>('SELECT * FROM cep_carga')
    await banco.sql('DELETE FROM cep_carga')
    try {
      const p = await repositorioPostgres(gestor).preparar([], ['01310100'])
      if ('motivo' in p) throw new Error(p.motivo)
      expect(p.basePublicadaEm).toBe(null)
      // A tabela cep continua cheia: os dois estados sao independentes, e e por
      // isso que basePublicadaEm precisa ser lido de cep_carga e nao deduzido
      // de "nenhum endereco resolveu".
      expect(p.enderecos.size).toBe(1)
    } finally {
      for (const l of guardadas) {
        await banco.sql(
          `INSERT INTO cep_carga (fonte, versao, publicado_em, arquivo_sha256, linhas)
           VALUES ($1, $2, $3, $4, $5)`,
          [l.fonte, l.versao, l.publicado_em, l.arquivo_sha256, l.linhas],
        )
      }
    }
  })
})

// O caso misto contra o banco de verdade: um CEP que existe e um que nao
// existe no MESMO arquivo. O teste de servico cobre isso com repositorio de
// mentira, onde o mapa de enderecos e escrito a mao; aqui quem responde e a
// consulta SQL.
//
// Ele nasce de um falso alarme na verificacao manual de 2026-09-09: o passo 10
// usava '99999999' como "CEP inexistente", e 99999999 EXISTE — e Sarandi/PR, e
// e o maior CEP da base. O relatorio estava certo e o dado de teste errado.
// '00000000' e seguro por construcao: o menor CEP existente e 01001000, e CEP
// todo zero nao e atribuivel.
describe('analisar: contagem de CEP contra o banco', () => {
  const CABECALHO_CSV = 'cnpj,razao_social,nome_fantasia,contato_nome,telefone,email,cep'
  const csv = (...linhas: string[]) => new TextEncoder().encode([CABECALHO_CSV, ...linhas].join('\n'))

  test('um CEP presente e um ausente: conta exatamente um nao encontrado', async () => {
    const r = await analisar(
      repositorioPostgres(gestor),
      csv(
        '11666777000106,Presente LTDA,,,1134567890,,01310100',
        '11777777000183,Ausente LTDA,,,1134567891,,00000000',
      ),
    )
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.cepsPedidos).toBe(2)
    expect(r.relatorio.cepsNaoEncontrados).toBe(1)
    expect(r.relatorio.basePublicadaEm).toBe('2024-07-08')
  })

  test('so CEP presente: nenhum nao encontrado', async () => {
    const r = await analisar(repositorioPostgres(gestor), csv('11666777000106,Presente LTDA,,,1134567890,,01310100'))
    if (!r.ok) throw new Error('esperava ok')
    expect(r.relatorio.cepsNaoEncontrados).toBe(0)
  })
})
