import { existsSync } from 'node:fs'
import { exigir, lerEnv, type ChaveUrl } from '../../src/server/db/env'

// Os CLIs rodam fora do Next e não usam @next/env: ele escolhe o arquivo pelo
// modo (development/test/production), não por NODE_ENV livre, então não serve
// para um alvo chamado "railway". Node 24 tem process.loadEnvFile nativo.
// Sem ALVO lê .env.local (container). ALVO=railway lê .env.railway.local, que o
// .gitignore já ignora por casar com .env*. Variável já presente no ambiente vence.
export function urlDe(chave: ChaveUrl): string {
  const arquivo = process.env.ALVO ? `.env.${process.env.ALVO}.local` : '.env.local'
  if (existsSync(arquivo)) process.loadEnvFile(arquivo)
  return exigir(lerEnv(), chave)
}

export function sair(ok: boolean, mensagem: string): never {
  console[ok ? 'log' : 'error'](mensagem)
  process.exit(ok ? 0 : 1)
}
