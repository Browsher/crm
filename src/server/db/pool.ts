import { Pool, type PoolClient } from 'pg'
import { exigir, lerEnv } from './env'
import { configSsl } from './ssl'

export class PapelPerigoso extends Error {
  constructor(detalhe: string) {
    super(
      `A conexão da aplicação tem privilégio que ignora RLS: ${detalhe}. Use um papel sem SUPERUSER e sem BYPASSRLS.`,
    )
    this.name = 'PapelPerigoso'
  }
}

type Registro = { pool: Pool; papelConferido: boolean }
const g = globalThis as typeof globalThis & { __crmPools?: Map<string, Registro> }
// Em globalThis para sobreviver ao hot reload do Next dev sem deixar pool órfão.
const pools = (g.__crmPools ??= new Map<string, Registro>())

function criar(url: string): Pool {
  const pool = new Pool({
    connectionString: url,
    ssl: configSsl(lerEnv()),
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    statement_timeout: 30_000,
  })
  pool.on('error', (erro) => console.error('[db] erro em conexão ociosa do pool', erro))
  return pool
}

export function obterPool(url: string = exigir(lerEnv(), 'DATABASE_URL')): Pool {
  let reg = pools.get(url)
  if (!reg) {
    reg = { pool: criar(url), papelConferido: false }
    pools.set(url, reg)
  }
  return reg.pool
}

async function conferirPapel(cliente: PoolClient): Promise<void> {
  const { rows } = await cliente.query<{ rolsuper: boolean; rolbypassrls: boolean; usuario: string }>(
    'SELECT r.rolsuper, r.rolbypassrls, current_user AS usuario FROM pg_roles r WHERE r.rolname = current_user',
  )
  const r = rows[0]
  if (r.rolsuper) throw new PapelPerigoso(`${r.usuario} é SUPERUSER`)
  if (r.rolbypassrls) throw new PapelPerigoso(`${r.usuario} tem BYPASSRLS`)
}

// Único jeito de pegar um cliente do pool. Na primeira vez por processo e por
// URL confere o papel; se for perigoso, lança e a aplicação não sobe.
export async function conectarVerificado(url: string = exigir(lerEnv(), 'DATABASE_URL')): Promise<PoolClient> {
  const pool = obterPool(url)
  const reg = pools.get(url)!
  const cliente = await pool.connect()
  if (reg.papelConferido) return cliente
  try {
    await conferirPapel(cliente)
    reg.papelConferido = true
    return cliente
  } catch (erro) {
    cliente.release()
    throw erro
  }
}

export async function fecharPool(url: string = exigir(lerEnv(), 'DATABASE_URL')): Promise<void> {
  const reg = pools.get(url)
  if (!reg) return
  pools.delete(url)
  await reg.pool.end()
}
