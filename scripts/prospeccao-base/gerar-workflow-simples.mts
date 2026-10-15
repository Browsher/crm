import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gerarWorkflowSimples, type WorkflowSimplesConfig } from '../../src/server/prospeccao-base/workflow-simples'

async function executar() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--saida') {
    throw new Error('Uso: gerar-workflow-simples --config <json> --saida <json novo>')
  }
  let config: WorkflowSimplesConfig
  try {
    config = JSON.parse(await readFile(resolve(args[1]), 'utf8')) as WorkflowSimplesConfig
  } catch {
    throw new Error('Não foi possível ler a configuração JSON')
  }
  const workflow = gerarWorkflowSimples(config)
  if (workflow.nodes.some(n => 'credentials' in n) || 'pinData' in workflow) throw new Error('Export contém dados de autenticação')
  try {
    await writeFile(resolve(args[3]), JSON.stringify(workflow, null, 2) + '\n', { flag: 'wx' })
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('O destino já existe')
    throw new Error('Não foi possível escrever o export')
  }
  console.log(JSON.stringify({ nos: workflow.nodes.length, destino: 'export_sem_credenciais', ativo: false }))
}
executar().catch(erro => {
  console.error(erro instanceof Error ? erro.message : 'Falha ao gerar workflow')
  process.exitCode = 1
})