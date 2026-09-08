import { readFileSync } from 'node:fs'
import { checkServerIdentity, type PeerCertificate } from 'node:tls'
import type { EnvBanco } from './env'

type ConfigSsl =
  | false
  | {
      rejectUnauthorized: true
      ca?: string
      checkServerIdentity?: (host: string, cert: PeerCertificate) => Error | undefined
    }

// PG_SSL_CA aceita o PEM inline ou um caminho de arquivo. Um PEM começa com
// '-----BEGIN'; qualquer outra coisa é tratada como caminho.
//
// PG_SSL_NOME_SERVIDOR pina o nome que o certificado precisa ter. Serve para o
// proxy público da Railway, que repassa o certificado interno do Postgres
// (SAN postgres.railway.internal) por um host que não está no SAN. A cadeia
// continua validada contra o CA pinado; só o nome conferido muda. O `pg`
// sobrescreve `servername` com o host, por isso o gancho é checkServerIdentity.
// Sem CA pinado, pinar nome não protege nada, então é recusado.
export function configSsl(env: Pick<EnvBanco, 'PG_SSL' | 'PG_SSL_CA' | 'PG_SSL_NOME_SERVIDOR'>): ConfigSsl {
  if (env.PG_SSL === 'off') return false
  if (env.PG_SSL_NOME_SERVIDOR && !env.PG_SSL_CA) {
    throw new Error('PG_SSL_NOME_SERVIDOR exige PG_SSL_CA: pinar nome só faz sentido com CA pinado')
  }
  if (!env.PG_SSL_CA) return { rejectUnauthorized: true }
  const ca = env.PG_SSL_CA.startsWith('-----BEGIN') ? env.PG_SSL_CA : readFileSync(env.PG_SSL_CA, 'utf8')
  if (!env.PG_SSL_NOME_SERVIDOR) return { rejectUnauthorized: true, ca }
  const nome = env.PG_SSL_NOME_SERVIDOR
  return {
    rejectUnauthorized: true,
    ca,
    checkServerIdentity: (_host, cert) => checkServerIdentity(nome, cert),
  }
}
