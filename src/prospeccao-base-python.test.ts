import { spawnSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('campanha preserva lock portátil e compatibilidade com o Google V2 em fixtures offline', () => {
  const result = spawnSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['-B', '-m', 'unittest', 'discover', '-s', 'scripts/prospeccao-campanha', '-p', 'test_*.py'],
    {
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        GOOGLE_PLANILHA_N8N_URL: '',
        GOOGLE_PLANILHA_N8N_TOKEN: '',
        GOOGLE_VERIFICACOES_URL: '',
        GOOGLE_VERIFICACOES_TOKEN: '',
      },
    },
  )
  expect(result.status, result.stdout + result.stderr + (result.error?.message ?? '')).toBe(0)
}, 65_000)
