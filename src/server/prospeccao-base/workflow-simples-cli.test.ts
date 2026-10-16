import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, test } from 'vitest'
import { gerarWorkflowSimples } from './workflow-simples'

const config = { planilhaId: 'sheet-cenario', evolutionUrl: 'https://evolution.test', instancia: 'teste',
  abas: { origem: 1, validacao: 2, exportacao: 3 } }
const temporarios: string[] = []
afterEach(() => temporarios.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })))
function executar(valor: unknown = config, existente = false, jsonInvalido = false, foraRaiz = false) {
  const pasta = mkdtempSync(join(tmpdir(), 'crm-simples-'))
  temporarios.push(pasta)
  const entrada = join(pasta, 'config.json')
  const saida = join(pasta, 'workflow.json')
  writeFileSync(entrada, jsonInvalido ? 'NAO-JSON-segredo' : JSON.stringify(valor))
  if (existente) writeFileSync(saida, 'preservar')
  const processo = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href, resolve('scripts/prospeccao-base/gerar-workflow-simples.mts'),
    '--config', entrada, '--saida', saida], { encoding: 'utf8', timeout: 60000, cwd: foraRaiz ? pasta : undefined })
  expect(processo.stdout + processo.stderr).not.toContain(pasta)
  expect(processo.stdout + processo.stderr).not.toContain('evolution.test')
  expect(processo.stdout + processo.stderr).not.toContain('NAO-JSON-segredo')
  return { processo, saida }
}

test('CLI produz JSON importável igual ao gerador sem autenticação, id externo ou pinData', () => {
  const { processo, saida } = executar()
  expect(processo.status, processo.stderr).toBe(0)
  const gerado = JSON.parse(readFileSync(saida, 'utf8'))
  expect(gerado).toEqual(gerarWorkflowSimples(config))
  expect(gerado).not.toHaveProperty('id')
  expect(gerado).not.toHaveProperty('pinData')
  expect(gerado.nodes.every((n: object) => !('credentials' in n))).toBe(true)
  expect(JSON.parse(processo.stdout)).toMatchObject({ destino: 'export_sem_credenciais', ativo: false })
}, 60000)

test('CLI recusa configuração inválida sem expor valores', () => {
  const r = executar({ ...config, planilhaId: 'id?segredo' })
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr).toContain('Configuração inválida')
}, 60000)

test('CLI não sobrescreve destino existente nem revela caminho no erro', () => {
  const r = executar(config, true)
  expect(r.processo.status).toBe(1)
  expect(readFileSync(r.saida, 'utf8')).toBe('preservar')
  expect(r.processo.stderr).toContain('O destino já existe')
}, 60000)

test('CLI recusa sintaxe JSON inválida sem incluir conteúdo na mensagem', () => {
  const r = executar(config, false, true)
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr).toContain('Não foi possível ler a configuração JSON')
}, 60000)

test('CLI sanitiza erro inesperado da geração fora da raiz sem revelar ENOENT ou caminho', () => {
  const r = executar(config, false, false, true)
  expect(r.processo.status).toBe(1)
  expect(r.processo.stderr.trim()).toBe('Falha ao gerar workflow')
  expect(r.processo.stdout).toBe('')
  expect(existsSync(r.saida)).toBe(false)
}, 60000)
