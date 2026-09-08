import { Client } from 'pg'
import { expect, test } from 'vitest'

test('conecta no Postgres do container como admin', async () => {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL_ADMIN })
  await cliente.connect()
  try {
    const { rows } = await cliente.query<{ versao: string }>('SELECT version() AS versao')
    expect(rows[0].versao).toMatch(/PostgreSQL 17/)
  } finally {
    await cliente.end()
  }
})
