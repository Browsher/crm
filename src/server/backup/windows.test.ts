import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

describe.skipIf(process.platform !== 'win32')('preparo do backup Windows', () => {
  test('gera chave recuperável, protege operacionalmente e não sobrescreve preparo', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'crm-backup-teste-'))
    try {
      const script = resolve('scripts/backup/windows.ps1')
      expect(existsSync(script)).toBe(true)
      const args = ['-NoProfile', '-NonInteractive', '-File', script, '-Modo', 'preparar', '-Estado', join(pasta, 'estado'), '-Destino', join(pasta, 'drive'), '-Repositorio', process.cwd()]
      const output = execFileSync('powershell.exe', args, { encoding: 'utf8' })
      const chave = readFileSync(join(pasta, 'estado', 'recuperacao.txt'), 'utf8').trim()
      expect(Buffer.from(chave, 'base64')).toHaveLength(32)
      expect(output).not.toContain(chave)
      expect(readFileSync(join(pasta, 'estado', 'chave.dpapi'))).not.toEqual(Buffer.from(chave, 'base64'))
      const roundtrip = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.Security; $b=[IO.File]::ReadAllBytes('${join(pasta, 'estado', 'chave.dpapi').replaceAll("'", "''")}'); $k=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($k)`], { encoding: 'utf8' }).trim()
      expect(roundtrip).toBe(chave)
      expect(() => execFileSync('powershell.exe', args, { stdio: 'pipe' })).toThrow()
      expect(readFileSync(join(pasta, 'estado', 'recuperacao.txt'), 'utf8').trim()).toBe(chave)
      writeFileSync(join(pasta, 'estado', 'resultado.json'), '{"ok":true}')
      expect(() => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, '-Modo', 'executar', '-Estado', join(pasta, 'estado')], { stdio: 'pipe' })).toThrow()
      expect(JSON.parse(readFileSync(join(pasta, 'estado', 'wrapper-resultado.json'), 'utf8')).ok).toBe(false)
    } finally {
      rmSync(pasta, { recursive: true, force: true })
    }
  }, 30_000)
  test('recusa estado fora de LOCALAPPDATA antes de gerar chave', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'crm-backup-raiz-'))
    try {
      const estado = join(pasta, 'estado')
      expect(() => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', resolve('scripts/backup/windows.ps1'), '-Modo', 'preparar', '-Estado', estado], { env: { ...process.env, LOCALAPPDATA: join(pasta, 'outro-perfil') }, stdio: 'pipe' })).toThrow()
      expect(existsSync(estado)).toBe(false)
    } finally { rmSync(pasta, { recursive: true, force: true }) }
  })
})
