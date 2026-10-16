import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gerarWorkflowAutomatico } from '../../src/server/prospeccao-base/workflow-automatico'
import type { WorkflowDriveConfig } from '../../src/server/prospeccao-base/workflow-drive'

async function executar() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--config' || args[2] !== '--saida') {
    throw new Error('Uso: gerar-workflow-automatico --config <json> --saida <json novo>')
  }
  let config: WorkflowDriveConfig & { webhookPath: string }
  try {
    config = JSON.parse(await readFile(resolve(args[1]), 'utf8')) as typeof config
  } catch {
    throw new Error('Não foi possível ler a configuração JSON')
  }
  let workflow: ReturnType<typeof gerarWorkflowAutomatico>
  try {
    workflow = gerarWorkflowAutomatico(config)
  } catch (erro) {
    if (erro instanceof Error && erro.message === 'Configuração inválida') throw erro
    throw new Error('Falha ao gerar workflow')
  }
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
