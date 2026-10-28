import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
test('publicacao exclui estado privado e backups do agente Google', () => {
  const linhas = readFileSync('.vercelignore', 'utf8').split(/\r?\n/)
  for (const pasta of ['.google-agente', '.env*', '.superpowers']) expect(linhas).toContain(pasta)
})
