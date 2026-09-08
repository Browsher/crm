import { criarPrimeiroGestor } from '../../src/server/db/seed'
import { sair, urlDe } from './env.mts'

const [nome, email] = process.argv.slice(2)
if (!nome || !email) sair(false, 'uso: npm run db:seed:gestor -- "Nome" email@dominio')
const r = await criarPrimeiroGestor(urlDe('DATABASE_URL_ADMIN'), { nome, email })
if (!r.ok) sair(false, `não criado: ${r.motivo}`)
// A senha vai SOZINHA no stdout, para copiar ou redirecionar sem arrastar nada.
// Tudo o mais vai no stderr.
console.error(`gestor criado: ${r.id}`)
console.error('Senha provisória abaixo. Não será mostrada de novo. O primeiro login exige a troca.')
process.stdout.write(`${r.senhaProvisoria}\n`)
process.exit(0)
