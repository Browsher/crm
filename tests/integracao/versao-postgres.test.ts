import { expect, test } from 'vitest'
import { comAdmin } from '@/src/server/db/admin'
import { exigir, lerEnv } from '@/src/server/db/env'
import { exigirHostLocal } from '@/src/server/db/host-local'

test.skipIf(!process.env.PG_VERSAO_ESPERADA)('servidor usa a versão maior de Postgres exigida pelo ambiente', async () => {
  const url = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
  exigirHostLocal(url)
  const versao = await comAdmin(url, async (cliente) => {
    const { rows } = await cliente.query<{ server_version_num: string }>('SHOW server_version_num')
    return Math.floor(Number(rows[0].server_version_num) / 10000)
  })
  expect(versao).toBe(Number(process.env.PG_VERSAO_ESPERADA))
})
