import { aplicar } from '../../src/server/db/migracoes/aplicar'
import { PASTA_MIGRACOES } from '../../src/server/db/migracoes/arquivos'
import { conferirInvariantes } from '../../src/server/db/migracoes/invariantes'
import { sair, urlDe } from './env.mts'

const url = urlDe('DATABASE_URL_ADMIN')
const r = await aplicar(url, PASTA_MIGRACOES)
if (!r.ok) sair(false, `não aplicado: ${r.motivo}\n${JSON.stringify(r.divergentes ?? r.problemas, null, 2)}`)
console.log(r.aplicadas.length ? `aplicadas: ${r.aplicadas.join(', ')}` : 'nada pendente')
const inv = await conferirInvariantes(url)
if (!inv.ok) sair(false, ['invariantes violadas:', ...inv.violacoes.map((v) => `  - ${v}`)].join('\n'))
sair(true, 'invariantes ok')
