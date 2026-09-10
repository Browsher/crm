import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as esperar } from 'node:timers/promises'

export function iniciarProcesso(args: string[], env: NodeJS.ProcessEnv) {
  return spawn(process.execPath, args, {
    env, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32',
  })
}

const encerramentos = new WeakMap<ChildProcess, Promise<void>>()

export function encerrarProcesso(filho: ChildProcess): Promise<void> {
  const existente = encerramentos.get(filho)
  if (existente) return existente
  const encerramento = encerrar(filho)
  encerramentos.set(filho, encerramento)
  return encerramento
}

function sinalizarGrupo(pid: number, sinal: NodeJS.Signals | 0): boolean {
  try { process.kill(-pid, sinal); return true } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ESRCH') return false
    throw erro
  }
}

async function encerrar(filho: ChildProcess) {
  if (!filho.pid) return
  const saiu = filho.exitCode !== null || filho.signalCode !== null
  const terminou = saiu ? Promise.resolve() : once(filho, 'exit').then(() => undefined)
  if (process.platform === 'win32') {
    if (saiu) return
    const matar = spawn('taskkill', ['/PID', String(filho.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    const [codigo] = await once(matar, 'exit')
    if (codigo !== 0 && filho.exitCode === null && filho.signalCode === null) {
      throw new Error(`Não foi possível encerrar árvore E2E ${filho.pid}`)
    }
  } else {
    // O líder pode terminar antes de seus workers. Acompanhar o grupo inteiro.
    if (sinalizarGrupo(filho.pid, 'SIGTERM')) {
      const prazo = Date.now() + 5_000
      while (sinalizarGrupo(filho.pid, 0) && Date.now() < prazo) await esperar(50)
      sinalizarGrupo(filho.pid, 'SIGKILL')
    }
  }
  await terminou
}
