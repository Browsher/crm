import { appendFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { decidirConferencia } from './politica-conferencia'

const decisao = decidirConferencia({
  temUrl: !!process.env.DATABASE_URL_CONFERENCIA?.trim(),
  fork: process.env.EH_FORK === 'true',
  autor: process.env.AUTOR_PR ?? '',
})

if (decisao === 'pular') {
  const motivo = process.env.EH_FORK === 'true' ? 'PR de fork' : 'PR do Dependabot'
  const nota = `### Migrações na Railway\n\n- conferência **não rodou**: ${motivo} não recebe o secret. As verificações locais continuam obrigatórias.\n`
  console.log(nota)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, nota)
} else if (decisao === 'falhar') {
  console.error('::error::DATABASE_URL_CONFERENCIA ausente em PR interno. O secret precisa ser restaurado.')
  process.exitCode = 1
} else if (!process.env.PG_SSL_CA?.trim()) {
  console.error('::error::variable PG_SSL_CA_RAILWAY ausente. A conferência exige o CA pinado.')
  process.exitCode = 1
} else {
  const filho = spawn(process.execPath, ['--import', 'tsx', 'scripts/db/pendentes.mts'], {
    stdio: 'inherit', windowsHide: true, env: process.env,
  })
  const [codigo] = await once(filho, 'exit')
  process.exitCode = codigo ?? 1
}
