import { loadEnvConfig } from '@next/env'

// Vitest define NODE_ENV=test. Nesse modo o @next/env carrega .env.test e
// .env.test.local, e pula .env.local de propósito: teste não fala com a Railway.
loadEnvConfig(process.cwd())
