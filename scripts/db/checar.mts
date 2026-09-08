import { lerMigracoes, PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { checarMigracoes } from '../../src/server/db/migracoes/checar'
import { sair } from './env.mts'

const r = checarMigracoes(await lerMigracoes(PASTA_MIGRACOES))
if (r.ok) sair(true, 'migrações: convenções ok')
sair(false, ['migrações: problemas', ...r.problemas.map((p) => `  - ${p}`)].join('\n'))
