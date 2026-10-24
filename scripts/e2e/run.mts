import { type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { access, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { parseEnv } from 'node:util'
import { setTimeout as esperar } from 'node:timers/promises'
import { criarBancoDeTeste, criarUsuarioComSenha, type BancoDeTeste } from '../../tests/integracao/ajuda'
import { ambienteDoBuild, ambienteDoServidor, exigirAdminLocal } from '../../tests/e2e/ambiente'
import { iniciarProcesso, encerrarProcesso } from './processos'
import { prepararEmpresasConsulta } from '../../tests/e2e/dados-consulta'
import { prepararEmpresasReserva } from '../../tests/e2e/dados-reserva'
import { prepararRecentes } from '../../tests/e2e/dados-recentes'
import { prepararFilaVisual } from '../../tests/e2e/dados-fila-visual'
import { prepararCarteiraVisual } from '../../tests/e2e/dados-carteira-visual'
import { prepararFunil } from '../../tests/e2e/dados-funil'
import { prepararMeuDia } from '../../tests/e2e/dados-meu-dia'
import { iniciarWhatsAppDeTeste } from '../../tests/e2e/whatsapp-mock'
import { prepararRedesign } from '../../tests/e2e/dados-redesign'
import { prepararGoogle, GOOGLE_TOKEN_E2E } from '../../tests/e2e/dados-google'
import { iniciarCnpjBizDeTeste, prepararBuscaDemo } from '../../tests/e2e/cnpj-biz-mock'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { iniciarSheetsDeTeste } from '../../tests/e2e/google-planilha-mock'

const filhos = new Set<ChildProcess>()
const interrupcao = new AbortController()
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => interrupcao.abort(new Error(`E2E interrompido: ${sinal}`)))
}

function iniciar(args: string[], env: NodeJS.ProcessEnv) {
  interrupcao.signal.throwIfAborted()
  const filho = iniciarProcesso(args, env)
  filhos.add(filho)
  return filho
}

async function executar(args: string[], env: NodeJS.ProcessEnv) {
  const filho = iniciar(args, env)
  const [codigo] = await once(filho, 'exit', { signal: interrupcao.signal })
  if (codigo !== 0) throw new Error(`Processo de E2E terminou com código ${codigo}`)
}

async function conferirPorta() {
  const servidor = createServer()
  servidor.listen(3100, '127.0.0.1')
  await once(servidor, 'listening')
  await new Promise<void>((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()))
}

let banco: BancoDeTeste | undefined
let whatsapp: Awaited<ReturnType<typeof iniciarWhatsAppDeTeste>> | undefined
let cnpj: Awaited<ReturnType<typeof iniciarCnpjBizDeTeste>> | undefined
let sheets: Awaited<ReturnType<typeof iniciarSheetsDeTeste>> | undefined
try {
  const padrao = parseEnv(await readFile('.env.test', 'utf8'))
  const urlAdmin = process.env.DATABASE_URL_ADMIN || padrao.DATABASE_URL_ADMIN
  if (!urlAdmin) throw new Error('DATABASE_URL_ADMIN local ausente')
  exigirAdminLocal(urlAdmin)
  await conferirPorta()
  process.env.DATABASE_URL_ADMIN = urlAdmin
  process.env.PG_SSL = 'off'
  process.env.ALVO = ''
  if (process.argv.includes('--sem-build')) await access('.next-e2e/BUILD_ID')
  else await executar(['node_modules/next/dist/bin/next', 'build'], ambienteDoBuild(process.env))

  banco = await criarBancoDeTeste()
  console.log(`E2E: banco temporário ${banco.nome}`)
  for (const [apelido, papel, pendente] of [
    ['gestore2e', 'gestor', false], ['vendedore2e', 'vendedor', false],
    ['invalidoe2e', 'vendedor', false], ['provisorioe2e', 'vendedor', true],
  ] as const) {
    await criarUsuarioComSenha(banco, papel, apelido, 'Senha-e2e-2026', { pendente })
  }
  await prepararEmpresasConsulta(banco)
  await prepararEmpresasReserva(banco)
  await prepararRecentes(banco)
  await prepararFilaVisual(banco)
  await prepararCarteiraVisual(banco)
  await prepararMeuDia(banco)
  await prepararFunil(banco)
  await prepararRedesign(banco)
  const google = await prepararGoogle(banco)
  await prepararBuscaDemo(banco)
  cnpj = await iniciarCnpjBizDeTeste()
  sheets = await iniciarSheetsDeTeste()
  whatsapp = await iniciarWhatsAppDeTeste(banco)
  const ambiente = ambienteDoServidor(process.env, banco.urlApp)
  Object.assign(ambiente, { GOOGLE_AGENTE_TOKEN: GOOGLE_TOKEN_E2E, GOOGLE_AGENTE_USUARIO_ID: google.gestorId })
  Object.assign(ambiente, { GOOGLE_PLANILHA_ID:'planilha-somente-e2e',GOOGLE_PLANILHA_ABA_ID:'123',GOOGLE_PLANILHA_CLIENT_EMAIL:sheets.email,GOOGLE_PLANILHA_PRIVATE_KEY:sheets.chave,GOOGLE_PLANILHA_MOCK_URL:sheets.url })
  Object.assign(ambiente, { EVOLUTION_API_URL: whatsapp.url, EVOLUTION_API_KEY: 'chave-apenas-e2e', EVOLUTION_INSTANCE_NAME: 'instancia-e2e', NODE_EXTRA_CA_CERTS: whatsapp.certificado })
  Object.assign(ambiente, { CNPJ_BIZ_API_KEY: 'chave-apenas-e2e', CNPJ_BIZ_MOCK_URL: cnpj.url })
  const servidor = iniciar(['--import', pathToFileURL(resolve('scripts/e2e/cnpj-biz-preload.mjs')).href, '--import',pathToFileURL(resolve('scripts/e2e/google-planilha-preload.mjs')).href,'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], ambiente)
  let erroServidor: Error | undefined
  servidor.on('error', (erro) => { erroServidor = erro })
  const prazo = Date.now() + 30_000
  while (true) {
    interrupcao.signal.throwIfAborted()
    if (erroServidor) throw erroServidor
    if (servidor.exitCode !== null || servidor.signalCode !== null) throw new Error('Servidor E2E encerrou antes de ficar pronto')
    try {
      const resposta = await fetch('http://127.0.0.1:3100/login', { signal: AbortSignal.timeout(1_000) })
      await resposta.arrayBuffer()
      if (resposta.ok) break
    } catch { /* Aguarda somente até o prazo abaixo. */ }
    if (Date.now() >= prazo) throw new Error('Servidor E2E não ficou pronto em 30 segundos')
    await esperar(200, undefined, { signal: interrupcao.signal })
  }
  // O E2E do Meu dia revoga posse "por fora" (tests/e2e/meu-dia.spec.ts): a
  // única forma de simular a mudança de outra sessão é falar com o próprio
  // banco temporário como admin, fora do app. `DATABASE_URL_ADMIN` some do
  // ambiente do servidor (`ambienteDoServidor`) de propósito; aqui ela volta
  // só para o processo do Playwright, que roda local e nunca é o app servido.
  await executar(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2).filter(arg => arg !== '--sem-build')], { ...ambiente, DATABASE_URL_ADMIN: banco.urlAdmin })
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  for (const filho of [...filhos].reverse()) {
    try { await encerrarProcesso(filho) } catch (erro) { console.error('Falha ao encerrar processo E2E', erro); process.exitCode = 1 }
  }
  await whatsapp?.fechar()
  await cnpj?.fechar()
  await sheets?.fechar()
  if (banco) {
    await banco.derrubar()
    console.log(`E2E: banco removido ${banco.nome}`)
  }
}
