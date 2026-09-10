import { once } from 'node:events'
import { iniciarProcesso, encerrarProcesso } from './processos'
import { ambienteDoBuild } from '../../tests/e2e/ambiente'

// Valores vazios impedem que o Next repesque credenciais em .env.local.
const filho = iniciarProcesso(['node_modules/next/dist/bin/next', 'build'], ambienteDoBuild(process.env))
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    process.exitCode = 1
    void encerrarProcesso(filho)
  })
}
try {
  const [codigo] = await once(filho, 'exit')
  process.exitCode = codigo ?? 1
} finally {
  await encerrarProcesso(filho)
}
