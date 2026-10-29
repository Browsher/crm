import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gerarWorkflow, type WorkflowConfig } from '../../src/server/prospeccao-base/workflow'

async function executar() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--saida') {
    throw new Error('Uso: gerar-workflow --config <json> --saida <json novo>')
  }
  const config = JSON.parse(await readFile(resolve(args[1]), 'utf8')) as WorkflowConfig
  const workflow = gerarWorkflow(config)
  const texto = JSON.stringify(workflow, null, 2) + '\n'
  if (workflow.nodes.some(n => 'credentials' in n) || 'pinData' in workflow) throw new Error('Export contém dados de autenticação')
  await writeFile(resolve(args[3]), texto, { flag: 'wx' })
  console.log(JSON.stringify({ nos: workflow.nodes.length, destino: 'export_sem_credenciais', ativo: false }))
}
executar().catch(erro => { console.error(erro instanceof Error ? erro.message : 'Falha ao gerar workflow'); process.exitCode = 1 })
