import { describe, expect, test } from 'vitest'
import { configSsl } from './ssl'

describe('configSsl', () => {
  test('off desliga TLS', () => {
    expect(configSsl({ PG_SSL: 'off' })).toBe(false)
  })

  test('verify sem CA valida contra as CAs do sistema', () => {
    expect(configSsl({ PG_SSL: 'verify' })).toEqual({ rejectUnauthorized: true })
  })

  test('verify com CA inline usa o PEM', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
    expect(configSsl({ PG_SSL: 'verify', PG_SSL_CA: pem })).toEqual({ rejectUnauthorized: true, ca: pem })
  })

  test('nunca devolve rejectUnauthorized false', () => {
    const casos = [{ PG_SSL: 'off' as const }, { PG_SSL: 'verify' as const }]
    for (const caso of casos) {
      const r = configSsl(caso)
      if (r !== false) expect(r.rejectUnauthorized).toBe(true)
    }
  })
})
