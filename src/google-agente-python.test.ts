import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'
test('ponte local preserva identidade, telefones, recibos e retomada sem executar coleta real', () => {
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'unittest', 'discover', '-s', 'scripts/google', '-p', 'test_*.py'], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  expect(r.status, r.stdout + r.stderr).toBe(0)
})
