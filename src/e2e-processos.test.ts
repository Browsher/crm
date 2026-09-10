import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { once } from 'node:events'
import { expect, test } from 'vitest'
import { iniciarProcesso, encerrarProcesso } from '../scripts/e2e/processos'

async function conferirEncerramento(liderSaiAntes: boolean) {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-e2e-processos-'))
  const arquivo = join(pasta, 'filho.json')
  const filho = iniciarProcesso(['-e', `
    const { spawn } = require('node:child_process')
    const { writeFileSync } = require('node:fs')
    const neto = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); process.send("pronto"); setInterval(() => {}, 1000)'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true })
    neto.once('message', () => {
      writeFileSync(process.argv[1], JSON.stringify({ pid: neto.pid }))
      if (process.argv[2] === 'true') process.exit(0)
    })
    setInterval(() => {}, 1000)
  `, arquivo, String(liderSaiAntes)], process.env)
  try {
    await expect.poll(async () => readFile(arquivo, 'utf8').catch(() => '')).not.toBe('')
    const { pid } = JSON.parse(await readFile(arquivo, 'utf8')) as { pid: number }
    process.kill(pid, 0)
    if (liderSaiAntes && filho.exitCode === null) await once(filho, 'exit')
    await Promise.all([encerrarProcesso(filho), encerrarProcesso(filho)])
    expect(filho.exitCode !== null || filho.signalCode !== null).toBe(true)
    // Windows pode levar alguns instantes para retirar o PID da tabela.
    await expect.poll(async () => {
      try {
        process.kill(pid, 0)
        if (process.platform === 'linux') {
          const estado = await readFile(`/proc/${pid}/stat`, 'utf8')
          return !estado.slice(estado.lastIndexOf(')') + 2).startsWith('Z')
        }
        return true
      } catch { return false }
    }).toBe(false)
    await encerrarProcesso(filho)
  } finally {
    await encerrarProcesso(filho)
    await esperar(20)
    await rm(pasta, { recursive: true, force: true })
  }
}

test('encerra processo próprio e descendente que ignora SIGTERM', () => conferirEncerramento(false), 15_000)
test.skipIf(process.platform !== 'linux')('encerra grupo mesmo quando líder já saiu', () => conferirEncerramento(true), 15_000)
