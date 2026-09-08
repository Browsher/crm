import { criarPrimeiroGestor } from '../../src/server/db/seed'
import { sair, urlDe } from './env.mts'

const [nome, email] = process.argv.slice(2)
if (!nome || !email) sair(false, 'uso: npm run db:seed:gestor -- "Nome" email@dominio')
const r = await criarPrimeiroGestor(urlDe('DATABASE_URL_ADMIN'), { nome, email })
if (!r.ok) sair(false, `não criado: ${r.motivo}`)
sair(true, `gestor criado: ${r.id}`)
