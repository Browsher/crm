import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unitario',
          environment: 'node',
          // app/**/*.test.tsx entrou com o bug do estado inicial de
          // /empresas/importar: um componente cliente decidiu sozinho qual
          // ramo renderizar e errou, que era exatamente a condição do gatilho
          // do jsdom em docs/db/divida-tecnica.md. Render por
          // renderToStaticMarkup, sem jsdom e sem dependência nova.
          include: ['src/**/*.test.ts', 'app/**/*.test.tsx'],
        },
      },
      {
        test: {
          name: 'integracao',
          environment: 'node',
          include: ['tests/integracao/**/*.test.ts'],
          setupFiles: ['tests/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
