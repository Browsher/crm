import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

const local = { CRM_E2E: '1', ALVO: '', DATABASE_URL: 'postgres://app_teste:teste@127.0.0.1:5432/teste_0123456789ab', CNPJ_BIZ_API_KEY: 'chave-apenas-e2e', CNPJ_BIZ_MOCK_URL: 'http://127.0.0.1:12345' }
function executar(env: Record<string, string>, codigo = '') {
  return spawnSync(process.execPath, ['--import', pathToFileURL(resolve('scripts/e2e/cnpj-biz-preload.mjs')).href, '-e', codigo], {
    env: { ...process.env, ...local, ...env }, encoding: 'utf8', timeout: 10_000, windowsHide: true,
  })
}

const recusados: Record<string, string>[] = [
  { CRM_E2E: '' }, { DATABASE_URL: 'postgres://app_teste:teste@remoto.example/teste_0123456789ab' },
  { DATABASE_URL: 'postgres://app_teste:teste@localhost/crm' }, { CNPJ_BIZ_API_KEY: 'chave-real-proibida' },
  { CNPJ_BIZ_MOCK_URL: 'http://remoto.example:12345' }, { ALVO: 'railway' },
]
test.each(recusados)('preload recusa simulação fora do ambiente local isolado: %j', env => {
  const resultado = executar(env)
  expect(resultado.status).not.toBe(0)
  expect(resultado.stderr).toContain('Ambiente de simulação CNPJ.biz inválido')
})

test('preload local falha fechado para rota do fornecedor fora das operações permitidas', () => {
  const resultado = executar({}, "fetch('https://cnpj.biz/api/v2/outra-rota').catch(e => { console.log(e.message) })")
  expect(resultado.status).toBe(0)
  expect(resultado.stdout).toContain('Rota CNPJ.biz fora da simulação')
})
