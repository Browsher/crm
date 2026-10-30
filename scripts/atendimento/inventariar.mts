import { inventariarTransicao } from '../../src/server/atendimento/transicao'
import { exigir, lerEnv } from '../../src/server/db/env'
import { exigirHostLocal } from '../../src/server/db/host-local'
import { fecharPool } from '../../src/server/db/pool'

// Não carrega arquivos privados. A conexão local deve ser fornecida no ambiente.
let codigo = 1
try {
  const args = process.argv.slice(2)
  const valores = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    if (!['--gestor', '--depois', '--limite'].includes(args[i]) || !args[i + 1] || valores.has(args[i])) throw new Error('argumentos')
    valores.set(args[i], args[i + 1])
  }
  if (!valores.has('--gestor') || !valores.has('--limite') || !/^[0-9]+$/.test(valores.get('--limite')!)) throw new Error('argumentos')
  const url = exigir(lerEnv(), 'DATABASE_URL')
  exigirHostLocal(url)
  const resultado = await inventariarTransicao(valores.get('--gestor')!, valores.get('--depois') ?? null, Number(valores.get('--limite')))
  console.log(JSON.stringify(resultado))
  codigo = resultado.ok ? 0 : 1
} catch {
  // Erros de infraestrutura podem conter URL, SQL e parâmetros: não serializar.
  console.error(JSON.stringify({ ok: false, motivo: 'inventario_recusado' }))
} finally {
  if (process.env.DATABASE_URL) await fecharPool().catch(() => {})
}
process.exitCode = codigo
