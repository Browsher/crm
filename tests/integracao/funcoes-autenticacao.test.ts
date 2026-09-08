import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { LinhaBloqueio, LinhaCredencial, LinhaSenhaTrocar, LinhaSessao } from '@/src/server/autenticacao/linhas'
import { chamar } from '@/src/server/db/sem-identidade'
import { criarBancoDeTeste, criarUsuario, type BancoDeTeste } from './ajuda'

let banco: BancoDeTeste
let vendedor: string

const FUTURO = new Date(Date.now() + 60 * 60 * 1000)
const PASSADO = new Date(Date.now() - 60 * 1000)

beforeAll(async () => {
  banco = await criarBancoDeTeste()
  vendedor = await criarUsuario(banco, 'vendedor', 'Vendedor')
  await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [vendedor, 'hash-qualquer'])
})
afterAll(async () => {
  await banco.derrubar()
})

// Insere falhas como dona, com data controlada, para provar janela e limites sem esperar.
const falhas = (n: number, email: string, origem: string | null, quando: Date) =>
  banco.sql(
    `INSERT INTO autenticacao.tentativa_login (email, origem, sucesso, ocorreu_em)
     SELECT $1, $2, false, $3 FROM generate_series(1, $4)`,
    [email, origem, quando, n],
  )

describe('credencial_por_email', () => {
  test('devolve a credencial com a situação do usuário; normaliza o e-mail por dentro', async () => {
    const r = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', ['  Vendedor@Teste.local '])
    expect(r).toEqual([{ usuario_id: vendedor, senha_hash: 'hash-qualquer', ativo: true, senha_provisoria_pendente: false }])
  })

  test('zero linhas para e-mail inexistente', async () => {
    expect(await chamar('credencial_por_email', ['ninguem@teste.local'])).toEqual([])
  })
})

describe('sessão', () => {
  test('criar e resolver', async () => {
    await chamar('sessao_criar', [vendedor, 'h1', FUTURO])
    const r = await chamar<'sessao_atual', LinhaSessao>('sessao_atual', ['h1'])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ usuario_id: vendedor, nome: 'Vendedor', papel: 'vendedor', senha_provisoria_pendente: false })
  })

  test('expirada devolve zero linhas', async () => {
    await chamar('sessao_criar', [vendedor, 'h-expirada', PASSADO])
    expect(await chamar('sessao_atual', ['h-expirada'])).toEqual([])
  })

  test('barreira da sessão: usuário desativado com sessão viva devolve zero linhas, sem passar por comoUsuario', async () => {
    const id = await criarUsuario(banco, 'vendedor', 'Demitido')
    await chamar('sessao_criar', [id, 'h-demitido', FUTURO])
    expect(await chamar('sessao_atual', ['h-demitido'])).toHaveLength(1)
    await banco.sql('UPDATE usuario SET ativo = false WHERE id = $1', [id])
    expect(await chamar('sessao_atual', ['h-demitido'])).toEqual([])
  })

  test('encerrar apaga', async () => {
    await chamar('sessao_criar', [vendedor, 'h-fim', FUTURO])
    await chamar('sessao_encerrar', ['h-fim'])
    expect(await chamar('sessao_atual', ['h-fim'])).toEqual([])
  })
})

describe('senha_trocar', () => {
  test('grava o hash, zera a marca, apaga as outras sessões e mantém a atual', async () => {
    const id = await criarUsuario(banco, 'gestor', 'Trocador')
    await banco.sql('INSERT INTO autenticacao.credencial (usuario_id, senha_hash) VALUES ($1, $2)', [id, 'antigo'])
    await banco.sql('UPDATE usuario SET senha_provisoria_pendente = true WHERE id = $1', [id])
    await chamar('sessao_criar', [id, 'atual', FUTURO])
    await chamar('sessao_criar', [id, 'outra', FUTURO])
    const r = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', ['atual', 'novo'])
    expect(r).toEqual([{ senha_trocar: id }])
    const [c] = await banco.sql<{ senha_hash: string }>('SELECT senha_hash FROM autenticacao.credencial WHERE usuario_id = $1', [id])
    expect(c.senha_hash).toBe('novo')
    const [u] = await banco.sql<{ p: boolean }>('SELECT senha_provisoria_pendente AS p FROM usuario WHERE id = $1', [id])
    expect(u.p).toBe(false)
    expect(await chamar('sessao_atual', ['atual'])).toHaveLength(1)
    expect(await chamar('sessao_atual', ['outra'])).toEqual([])
  })

  test('hash de sessão inválido devolve nulo e não muda nada', async () => {
    const r = await chamar<'senha_trocar', LinhaSenhaTrocar>('senha_trocar', ['nao-existe', 'x'])
    expect(r).toEqual([{ senha_trocar: null }])
  })
})

describe('limite de tentativas', () => {
  const RECENTE = new Date(Date.now() - 60 * 1000)
  const VELHO = new Date(Date.now() - 16 * 60 * 1000)

  test('sem tentativas, não bloqueia', async () => {
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['limpo@teste.local', '10.0.0.1'])
    expect(r).toEqual([{ bloqueado: false, segundos_restantes: 0 }])
  })

  test('10 falhas do e-mail na janela bloqueiam, com segundos restantes até 15 minutos', async () => {
    await falhas(9, 'alvo@teste.local', null, RECENTE)
    const antes = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['alvo@teste.local', null])
    expect(antes[0].bloqueado).toBe(false)
    const decima = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', ['alvo@teste.local', null, false])
    expect(decima[0].bloqueado).toBe(true)
    expect(decima[0].segundos_restantes).toBeGreaterThan(14 * 60)
    expect(decima[0].segundos_restantes).toBeLessThanOrEqual(15 * 60)
  })

  test('falhas fora da janela não contam', async () => {
    await falhas(10, 'velho@teste.local', null, VELHO)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['velho@teste.local', null])
    expect(r[0].bloqueado).toBe(false)
  })

  test('e-mail com maiúscula e espaço conta junto', async () => {
    await falhas(10, 'caixa@teste.local', null, RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['  Caixa@Teste.local ', null])
    expect(r[0].bloqueado).toBe(true)
  })

  test('30 falhas da origem, em e-mails diferentes, bloqueiam a origem', async () => {
    for (let i = 0; i < 30; i++) await falhas(1, `v${i}@teste.local`, '10.0.0.9', RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['novo@teste.local', '10.0.0.9'])
    expect(r[0].bloqueado).toBe(true)
  })

  test('acerto zera as falhas do e-mail e não zera as da origem', async () => {
    await falhas(5, 'zera@teste.local', '10.0.0.7', RECENTE)
    await falhas(30, 'outro@teste.local', '10.0.0.7', RECENTE)
    const acerto = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', ['zera@teste.local', '10.0.0.7', true])
    expect(acerto).toEqual([{ bloqueado: false, segundos_restantes: 0 }])
    const [{ n }] = await banco.sql<{ n: number }>(
      "SELECT count(*)::int AS n FROM autenticacao.tentativa_login WHERE email = 'zera@teste.local' AND NOT sucesso",
    )
    expect(n).toBe(0)
    const origem = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['qualquer@teste.local', '10.0.0.7'])
    expect(origem[0].bloqueado).toBe(true)
  })

  test('origem nula conta só por e-mail', async () => {
    await falhas(30, 'so-email@teste.local', null, RECENTE)
    const r = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', ['outro-email@teste.local', null])
    expect(r[0].bloqueado).toBe(false)
  })
})
