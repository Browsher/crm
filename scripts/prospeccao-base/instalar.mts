import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { instalarAlvo } from '../../src/server/prospeccao-base/instalar'
import type { WorkflowExport } from '../../src/server/prospeccao-base/workflow'

async function executar() {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args[0] !== '--workflow') throw new Error('Uso: instalar --workflow <json gerado>')
  const exportado = JSON.parse(await readFile(resolve(args[1]), 'utf8')) as WorkflowExport
  const saida = resolve('outputs/base-prospeccao-2026-10-14')
  await mkdir(saida, { recursive: true })
  const r = await instalarAlvo({
    baseUrl: process.env.N8N_API_URL ?? 'https://primary-production-04eb.up.railway.app',
    apiKey: process.env.N8N_API_KEY ?? '', workflowId: 'NxCO8HiaJmwqJ8jK', projectId: 'mIsmhrUTAVI1ZPnf',
    guardarAnterior: async anterior => {
      const nome = 'workflow-anterior-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
      await writeFile(resolve(saida, nome), JSON.stringify(anterior, null, 2) + '\n', { flag: 'wx' })
    },
  }, exportado, fetch)
  await writeFile(resolve(saida, 'instalacao.json'), JSON.stringify({ ...r, verificadoEm: new Date().toISOString() }, null, 2) + '\n')
  console.log(JSON.stringify(r))
  if (!r.ok) process.exitCode = 1
}
executar().catch(() => { console.error('Falha na instalação. Confira acesso e arquivo.'); process.exitCode = 1 })
