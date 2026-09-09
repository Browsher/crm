import { carregar } from '../../src/server/cep/carregar'
import { lerManifesto } from '../../src/server/cep/manifesto'
import { sair, urlDe } from './env.mts'

const [caminhoZip, caminhoManifesto = 'db/cep/opencep.json'] = process.argv.slice(2)
if (!caminhoZip) {
  sair(false, 'uso: npm run db:cep:carregar -- <caminho-do-zip> [caminho-do-manifesto]')
}

const url = urlDe('DATABASE_URL_ADMIN')
const manifesto = lerManifesto(caminhoManifesto)
console.log(`host: ${new URL(url).host}`)
console.log(`base: ${manifesto.fonte} ${manifesto.versao}, publicada em ${manifesto.publicado_em}`)

const inicio = Date.now()
const r = await carregar({ urlAdmin: url, caminhoZip, manifesto })
const segundos = ((Date.now() - inicio) / 1000).toFixed(1)

if (!r.ok) sair(false, `não carregado (${r.motivo}): ${r.detalhe}`)
sair(true, `carregadas ${r.linhas} linhas em ${segundos}s`)
