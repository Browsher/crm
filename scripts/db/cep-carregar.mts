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
const decorrido = () => ((Date.now() - inicio) / 1000).toFixed(1)

// A cada 50 mil dá ~24 avisos na base real: o bastante para o operador ver que
// anda, pouco o suficiente para não virar ruído nem encher log de deploy.
const PASSO = 50_000

const r = await carregar({
  urlAdmin: url,
  caminhoZip,
  manifesto,
  aoFase: (fase) => console.log(`[${decorrido()}s] ${fase}`),
  aoProgredir: (lidas) => {
    // "de ~N" com til de propósito: N é a contagem depois da deduplicação, e
    // aqui contamos entradas lidas. O total final passa de N por poucas
    // unidades, e um número que ultrapassa o denominador sem aviso assusta.
    if (lidas % PASSO === 0) console.log(`[${decorrido()}s]   ${lidas} de ~${manifesto.linhas_esperadas} entradas`)
  },
})

if (!r.ok) sair(false, `não carregado (${r.motivo}): ${r.detalhe}`)
sair(true, `carregadas ${r.linhas} linhas em ${decorrido()}s`)
