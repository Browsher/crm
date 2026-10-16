import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, test } from 'vitest'

const config = { planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'teste',
  abas: { origem: 1, validacao: 2, exportacao: 3 }, backupId: 10151005, driveRaizId: 'raiz-teste' }
const temporarios: string[] = []
afterEach(() => temporarios.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })))
function executar(valor: unknown = config, existente = false, invalido = false, foraRaiz = false) {
  const pasta = mkdtempSync(join(tmpdir(), 'crm-backup-'))
  temporarios.push(pasta)
  const entrada = join(pasta, 'config.json')
  const saida = join(pasta, 'workflow.json')
  writeFileSync(entrada, invalido ? 'segredo-json-invalido' : JSON.stringify(valor))
  if (existente) writeFileSync(saida, 'preservar')
  const processo = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href,
    resolve('scripts/prospeccao-base/gerar-workflow-drive.mts'), '--config', entrada, '--saida', saida],
  { encoding: 'utf8', timeout: 60000, cwd: foraRaiz ? pasta : undefined })
  expect(processo.stdout + processo.stderr).not.toContain(pasta)
  expect(processo.stdout + processo.stderr).not.toContain('evolution.test')
  expect(processo.stdout + processo.stderr).not.toContain('segredo-json-invalido')
  return { processo, saida }
}

test('CLI gera variante separada sem segredos com CSV Drive', () => {
  const r = executar()
  expect(r.processo.status, r.processo.stderr).toBe(0)
  const w = JSON.parse(readFileSync(r.saida, 'utf8'))
  expect(w).not.toHaveProperty('id')
  expect(w).not.toHaveProperty('pinData')
  expect(w.nodes.every((n: object) => !('credentials' in n))).toBe(true)
  expect(w.nodes.map((n: { name: string }) => n.name)).toEqual(expect.arrayContaining(['Ler raiz Drive', 'Concluir pendência Drive', 'Enviar CSV atual', 'Conferir CSV atual', 'Preservar backup']))
  expect(w.connections['Conferir backup atual']).toMatchObject({ main: [[{ node: 'Substituir saídas' }]] })
  expect(JSON.parse(r.processo.stdout)).toMatchObject({ destino: 'export_sem_credenciais', ativo: false })
}, 60000)

test('CLI não sobrescreve destino existente', () => {
  const r = executar(config, true)
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr.trim()).toBe('O destino já existe')
  expect(readFileSync(r.saida, 'utf8')).toBe('preservar')
}, 60000)

test('CLI recusa backup colidente sem escrever artefato', () => {
  const r = executar({ ...config, backupId: 1 })
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr.trim()).toBe('Configuração inválida')
  expect(existsSync(r.saida)).toBe(false)
}, 60000)

test('CLI sanitiza JSON inválido', () => {
  const r = executar(config, false, true)
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr.trim()).toBe('Não foi possível ler a configuração JSON')
}, 60000)

test('CLI sanitiza erro de infraestrutura fora da raiz', () => {
  const r = executar(config, false, false, true)
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr.trim()).toBe('Falha ao gerar workflow')
  expect(existsSync(r.saida)).toBe(false)
}, 60000)
