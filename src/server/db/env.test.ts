import { describe, expect, test } from 'vitest'
import { exigir, lerEnv } from './env'

describe('lerEnv', () => {
  test('PG_SSL ausente vira verify', () => {
    expect(lerEnv({}).PG_SSL).toBe('verify')
  })

  test('aceita off e verify', () => {
    expect(lerEnv({ PG_SSL: 'off' }).PG_SSL).toBe('off')
    expect(lerEnv({ PG_SSL: 'verify' }).PG_SSL).toBe('verify')
  })

  test('recusa qualquer outro valor, inclusive inseguro', () => {
    expect(() => lerEnv({ PG_SSL: 'inseguro' })).toThrow(/PG_SSL/)
    expect(() => lerEnv({ PG_SSL: 'true' })).toThrow(/PG_SSL/)
  })

  test('URLs são opcionais na leitura e exigidas por quem usa', () => {
    const env = lerEnv({ DATABASE_URL: 'postgres://a' })
    expect(exigir(env, 'DATABASE_URL')).toBe('postgres://a')
    expect(() => exigir(env, 'DATABASE_URL_ADMIN')).toThrow(/DATABASE_URL_ADMIN/)
  })

  test('PG_SSL_NOME_SERVIDOR é opcional e vazio vira ausente', () => {
    expect(lerEnv({}).PG_SSL_NOME_SERVIDOR).toBeUndefined()
    expect(lerEnv({ PG_SSL_NOME_SERVIDOR: '' }).PG_SSL_NOME_SERVIDOR).toBeUndefined()
    expect(lerEnv({ PG_SSL_NOME_SERVIDOR: 'postgres.railway.internal' }).PG_SSL_NOME_SERVIDOR).toBe('postgres.railway.internal')
  })

  test('string vazia conta como ausente', () => {
    expect(() => exigir(lerEnv({ DATABASE_URL: '' }), 'DATABASE_URL')).toThrow(/DATABASE_URL/)
  })
})

describe('limite de conexões do pool', () => {
  test('mantém dez por padrão e trata vazio como não configurado', () => {
    expect(lerEnv({}).PG_POOL_MAX).toBe(10)
    expect(lerEnv({ PG_POOL_MAX: '  ' }).PG_POOL_MAX).toBe(10)
  })

  test('aceita limite menor para instâncias da Vercel', () => {
    expect(lerEnv({ PG_POOL_MAX: '2' }).PG_POOL_MAX).toBe(2)
    expect(lerEnv({ PG_POOL_MAX: '1' }).PG_POOL_MAX).toBe(1)
    expect(lerEnv({ PG_POOL_MAX: '10' }).PG_POOL_MAX).toBe(10)
  })

  test.each(['0', '-1', '11', '2.5', 'Infinity', 'abc'])(
    'recusa limite inválido %s antes de abrir conexão', (valor) => {
      expect(() => lerEnv({ PG_POOL_MAX: valor })).toThrow(/PG_POOL_MAX/)
    },
  )
})