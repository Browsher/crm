import { readFileSync } from 'node:fs'
import type { EnvBanco } from './env'

type ConfigSsl = false | { rejectUnauthorized: true; ca?: string }

// PG_SSL_CA aceita o PEM inline ou um caminho de arquivo. Um PEM começa com
// '-----BEGIN'; qualquer outra coisa é tratada como caminho.
export function configSsl(env: Pick<EnvBanco, 'PG_SSL' | 'PG_SSL_CA'>): ConfigSsl {
  if (env.PG_SSL === 'off') return false
  if (!env.PG_SSL_CA) return { rejectUnauthorized: true }
  const ca = env.PG_SSL_CA.startsWith('-----BEGIN') ? env.PG_SSL_CA : readFileSync(env.PG_SSL_CA, 'utf8')
  return { rejectUnauthorized: true, ca }
}
