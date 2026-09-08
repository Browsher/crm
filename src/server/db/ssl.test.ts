import type { PeerCertificate } from 'node:tls'
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

  test('verify com nome de servidor valida o certificado contra o nome pinado, não contra o host', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
    const r = configSsl({ PG_SSL: 'verify', PG_SSL_CA: pem, PG_SSL_NOME_SERVIDOR: 'postgres.railway.internal' })
    expect(r).toMatchObject({ rejectUnauthorized: true, ca: pem })
    if (r === false || !r.checkServerIdentity) throw new Error('checkServerIdentity ausente')
    // Certificado real do proxy da Railway: CN=localhost, SAN interno, host público fora do SAN.
    const cert = {
      subject: { CN: 'localhost' },
      subjectaltname: 'DNS:localhost, DNS:postgres.railway.internal',
    } as unknown as PeerCertificate
    expect(r.checkServerIdentity('altaria.proxy.rlwy.net', cert)).toBeUndefined()
    const outro = { ...cert, subjectaltname: 'DNS:outro.exemplo' } as unknown as PeerCertificate
    expect(r.checkServerIdentity('altaria.proxy.rlwy.net', outro)).toBeInstanceOf(Error)
  })

  test('nome de servidor sem CA é recusado: pinar nome só faz sentido com CA pinado', () => {
    expect(() => configSsl({ PG_SSL: 'verify', PG_SSL_NOME_SERVIDOR: 'x' })).toThrow(/PG_SSL_CA/)
  })

  test('nunca devolve rejectUnauthorized false', () => {
    const casos = [{ PG_SSL: 'off' as const }, { PG_SSL: 'verify' as const }]
    for (const caso of casos) {
      const r = configSsl(caso)
      if (r !== false) expect(r.rejectUnauthorized).toBe(true)
    }
  })
})
