import { expect, test } from 'vitest'
import { ambienteDoServidor, exigirAdminLocal } from '../tests/e2e/ambiente'

test('isola credenciais e SSL herdados sem alterar o ambiente pai', () => {
  const fonte: NodeJS.ProcessEnv = { NODE_ENV: 'test', DATABASE_URL_ADMIN: 'admin', DATABASE_URL: 'remota', ALVO: 'railway', PG_SSL: 'verify', PG_SSL_CA: 'ca' }
  expect(ambienteDoServidor(fonte, 'postgres://app_teste:teste@localhost:5432/teste_0123456789ab')).toMatchObject({
    DATABASE_URL_ADMIN: '', DATABASE_URL_CONFERENCIA: '', ALVO: '', PG_SSL: 'off', PG_SSL_CA: '',
    DATABASE_URL: 'postgres://app_teste:teste@localhost:5432/teste_0123456789ab', CRM_E2E: '1', NODE_ENV: 'production',
  })
  expect(fonte.DATABASE_URL_ADMIN).toBe('admin')
})

test('URL admin recusa host sobrescrito por parâmetro antes de criar banco', () => {
  expect(() => exigirAdminLocal('postgres://postgres:postgres@localhost/postgres?host=remoto.example')).toThrow()
})

test.each([
  'postgres://app_teste:teste@railway.internal/teste_0123456789ab',
  'postgres://postgres:teste@localhost/teste_0123456789ab',
  'postgres://app_teste:teste@localhost/crm',
])('recusa URL fora do banco descartável restrito: %s', (url) => {
  expect(() => ambienteDoServidor({ NODE_ENV: 'test' }, url)).toThrow()
})
