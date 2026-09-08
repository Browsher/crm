import { comAdmin } from '../../src/server/db/admin'
import { sair, urlDe } from './env.mts'

const PAPEIS = ['app_conexao', 'app_conferencia']
const [papel, senha] = process.argv.slice(2)
if (!papel || !PAPEIS.includes(papel) || !senha) {
  sair(false, 'uso: npm run db:senha -- <app_conexao|app_conferencia> <senha>')
}

// ALTER ROLE ... PASSWORD não aceita $1. O identificador vem de lista fechada;
// a senha vai como literal com aspas simples dobradas.
const literal = `'${senha.replace(/'/g, "''")}'`
await comAdmin(urlDe('DATABASE_URL_ADMIN'), (c) => c.query(`ALTER ROLE ${papel} LOGIN PASSWORD ${literal}`))
sair(true, `${papel}: LOGIN e senha definidos`)
