import { z } from 'zod'

const vazioViraUndefined = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
)

const esquema = z.object({
  DATABASE_URL: vazioViraUndefined,
  DATABASE_URL_ADMIN: vazioViraUndefined,
  DATABASE_URL_CONFERENCIA: vazioViraUndefined,
  PG_SSL: z.enum(['off', 'verify']).default('verify'),
  PG_SSL_CA: vazioViraUndefined,
})

export type EnvBanco = z.infer<typeof esquema>
export type ChaveUrl = 'DATABASE_URL' | 'DATABASE_URL_ADMIN' | 'DATABASE_URL_CONFERENCIA'

// Leitura preguiçosa: nada aqui roda na avaliação do módulo. `next build`
// avalia módulos sem env, e o CI faz isso de propósito.
export function lerEnv(fonte: Record<string, string | undefined> = process.env): EnvBanco {
  const resultado = esquema.safeParse(fonte)
  if (resultado.success) return resultado.data
  const campos = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`Variáveis de ambiente inválidas: ${campos}`)
}

export function exigir(env: EnvBanco, chave: ChaveUrl): string {
  const valor = env[chave]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${chave}`)
  return valor
}
