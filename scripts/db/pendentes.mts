import { appendFile } from 'node:fs/promises'
import { situacao } from '../../src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { sair, urlDe } from './env.mts'

// Usa a URL de conferência quando existir (CI), senão a admin (dev).
const chave = process.env.DATABASE_URL_CONFERENCIA ? 'DATABASE_URL_CONFERENCIA' : 'DATABASE_URL_ADMIN'
const s = await situacao(urlDe(chave), PASTA_MIGRACOES)
const resumo = [
  `aplicadas: ${s.aplicadas.length}`,
  s.pendentes.length ? `pendentes: ${s.pendentes.join(', ')}` : 'nada pendente',
]
if (s.divergentes.length) resumo.push(`divergentes: ${s.divergentes.map((d) => d.nome).join(', ')}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `### Migrações na Railway\n\n${resumo.map((l) => `- ${l}`).join('\n')}\n`,
  )
}
if (s.divergentes.length) {
  sair(false, ['migração aplicada foi alterada:', ...s.divergentes.map((d) => `  - ${d.nome}`)].join('\n'))
}
sair(true, resumo.join('\n'))
