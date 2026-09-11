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
  const ambiente = ambienteDoServidor(process.env, banco.urlApp)
  const servidor = iniciar(['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], ambiente)
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
  await executar(['node_modules/@playwright/test/cli.js', 'test'], ambiente)
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
} finally {
  for (const filho of [...filhos].reverse()) {
    try { await encerrarProcesso(filho) } catch (erro) { console.error('Falha ao encerrar processo E2E', erro); process.exitCode = 1 }
  }
  if (banco) {
    await banco.derrubar()
    console.log(`E2E: banco removido ${banco.nome}`)
  }
}
