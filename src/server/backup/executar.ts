import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { cifrar, decifrar } from './pacote'

export const LIMITE_COLETA_BYTES = 64 * 1024 * 1024

export type NomeAlvo = 'local' | 'railway'

export interface ColetorBackup {
  nome: NomeAlvo
  coletar(): Promise<{ banco: Buffer; papeis: Buffer }>
}

export interface AlvoPostgres {
  nome: NomeAlvo
  host: string
  porta: string
  banco: string
  usuario: string
  senha: string
  ssl: boolean
  ca?: string
  nomeServidorTls?: string
  enderecoProxy?: string
}

type ResultadoAlvo =
  | { ok: true; etapa: 'sincronizacao_nao_confirmada'; arquivo: string }
  | { ok: false; etapa: 'falha'; motivo: string }

export interface ResultadoBackup {
  ok: boolean
  inicio: string
  fim: string
  sincronizacaoRemotaConfirmada: false
  rotacaoExecutada: false
  alvos: Partial<Record<NomeAlvo, ResultadoAlvo>>
  motivo?: string
}

interface OpcoesBackup {
  destino: string
  estado: string
  chave: Buffer
  coletores: ColetorBackup[]
  agora?: () => Date
  criarId?: () => string
}

interface ConteudoPacote {
  versao: 1
  manifesto: {
    versao: 1
    origem: NomeAlvo
    criadoEm: string
    arquivos: {
      'banco.dump': { sha256: string; bytes: number }
      'papeis.sql': { sha256: string; bytes: number }
    }
  }
  bancoDump: string
  papeisSql: string
}

function hash(conteudo: Buffer) {
  return createHash('sha256').update(conteudo).digest('hex')
}

function nomeArquivo(data: Date, id: string) {
  return `crm-backup-${data.toISOString().replaceAll(':', '-').replace('.', '-')}-${id}.crmbackup`
}

function criarConteudo(nome: NomeAlvo, criadoEm: string, banco: Buffer, papeis: Buffer): ConteudoPacote {
  return {
    versao: 1,
    manifesto: {
      versao: 1,
      origem: nome,
      criadoEm,
      arquivos: {
        'banco.dump': { sha256: hash(banco), bytes: banco.length },
        'papeis.sql': { sha256: hash(papeis), bytes: papeis.length }
      }
    },
    bancoDump: banco.toString('base64'),
    papeisSql: papeis.toString('base64')
  }
}

function lerConteudo(pacote: Buffer, chave: Buffer): { conteudo: ConteudoPacote; banco: Buffer; papeis: Buffer } {
  const texto = decifrar(pacote, chave).toString('utf8')
  const conteudo = JSON.parse(texto) as ConteudoPacote
  if (conteudo.versao !== 1 || conteudo.manifesto?.versao !== 1) throw new Error('pacote inválido')
  if (conteudo.manifesto.origem !== 'local' && conteudo.manifesto.origem !== 'railway') throw new Error('pacote inválido')
  const banco = Buffer.from(conteudo.bancoDump, 'base64')
  const papeis = Buffer.from(conteudo.papeisSql, 'base64')
  const arquivos = conteudo.manifesto.arquivos
  if (
    arquivos?.['banco.dump']?.sha256 !== hash(banco) ||
    arquivos['banco.dump'].bytes !== banco.length ||
    arquivos?.['papeis.sql']?.sha256 !== hash(papeis) ||
    arquivos['papeis.sql'].bytes !== papeis.length
  ) throw new Error('integridade inválida')
  return { conteudo, banco, papeis }
}

async function salvarResultado(estado: string, resultado: ResultadoBackup) {
  await mkdir(estado, { recursive: true })
  const temporario = join(estado, `resultado-${randomBytes(8).toString('hex')}.tmp`)
  await writeFile(temporario, JSON.stringify(resultado, null, 2), { flag: 'wx' })
  await rename(temporario, join(estado, 'resultado.json'))
}

function resultadoBase(inicio: string): ResultadoBackup {
  return {
    ok: false,
    inicio,
    fim: inicio,
    sincronizacaoRemotaConfirmada: false,
    rotacaoExecutada: false,
    alvos: {}
  }
}

export async function executarBackup(opcoes: OpcoesBackup): Promise<ResultadoBackup> {
  const agora = opcoes.agora ?? (() => new Date())
  const inicioData = agora()
  const resultado = resultadoBase(inicioData.toISOString())
  try {
    await access(opcoes.destino)
  } catch {
    resultado.motivo = 'destino_indisponivel'
    resultado.fim = agora().toISOString()
    await salvarResultado(opcoes.estado, resultado)
    return resultado
  }

  await mkdir(opcoes.estado, { recursive: true })
  const caminhoLock = join(opcoes.estado, 'backup.lock')
  const tokenLock = randomBytes(32).toString('hex')
  let lock: Awaited<ReturnType<typeof open>>
  try {
    lock = await open(caminhoLock, 'wx')
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== 'EEXIST') throw erro
    resultado.motivo = 'execucao_em_andamento'
    resultado.fim = agora().toISOString()
    return resultado
  }

  try {
    await lock.writeFile(JSON.stringify({ token: tokenLock, pid: process.pid, inicio: resultado.inicio }))
    for (const coletor of opcoes.coletores) {
      try {
        const { banco, papeis } = await coletor.coletar()
        if (banco.length > LIMITE_COLETA_BYTES || papeis.length > LIMITE_COLETA_BYTES) {
          resultado.alvos[coletor.nome] = { ok: false, etapa: 'falha', motivo: 'coleta_excede_64_mib' }
          continue
        }
        const criadoEm = inicioData.toISOString()
        const claro = Buffer.from(JSON.stringify(criarConteudo(coletor.nome, criadoEm, banco, papeis)))
        const pacote = cifrar(claro, opcoes.chave)
        lerConteudo(pacote, opcoes.chave)
        const pastaAlvo = join(opcoes.destino, coletor.nome)
        await mkdir(pastaAlvo, { recursive: true })
        const nome = nomeArquivo(inicioData, (opcoes.criarId ?? (() => randomBytes(4).toString('hex')))())
        const temporario = join(pastaAlvo, `.${nome}.${randomBytes(8).toString('hex')}.tmp`)
        await writeFile(temporario, pacote, { flag: 'wx' })
        await rename(temporario, join(pastaAlvo, nome))
        resultado.alvos[coletor.nome] = { ok: true, etapa: 'sincronizacao_nao_confirmada', arquivo: nome }
      } catch {
        resultado.alvos[coletor.nome] = { ok: false, etapa: 'falha', motivo: 'falha_na_coleta' }
      }
    }
    resultado.ok = opcoes.coletores.length > 0 && opcoes.coletores.every(({ nome }) => resultado.alvos[nome]?.ok)
    resultado.fim = agora().toISOString()
    await salvarResultado(opcoes.estado, resultado)
    return resultado
  } finally {
    await lock.close()
    try {
      const atual = JSON.parse(await readFile(caminhoLock, 'utf8')) as { token?: string }
      if (atual.token === tokenLock) await rm(caminhoLock, { force: true })
    } catch {
      // Lock ausente ou substituído por conteúdo desconhecido: nunca removê-lo.
    }
  }
}

export async function recuperarPacote(arquivo: string, destinoNovo: string, chave: Buffer) {
  const pacote = await lerPacoteLimitado(arquivo)
  const { conteudo, banco, papeis } = lerConteudo(pacote, chave)
  try {
    await mkdir(destinoNovo)
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('a pasta de recuperação deve ser nova')
    throw erro
  }
  try {
    await writeFile(join(destinoNovo, 'banco.dump'), banco, { flag: 'wx' })
    await writeFile(join(destinoNovo, 'papeis.sql'), papeis, { flag: 'wx' })
    await writeFile(join(destinoNovo, 'manifesto.json'), JSON.stringify(conteudo.manifesto, null, 2), { flag: 'wx' })
  } catch (erro) {
    throw erro
  }
  return { ok: true as const }
}

interface LeituraLimitada {
  obterTamanho?: (arquivo: string) => Promise<number>
  ler?: (arquivo: string) => Promise<Buffer>
}

export async function lerPacoteLimitado(arquivo: string, opcoes: LeituraLimitada = {}) {
  const limite = LIMITE_COLETA_BYTES * 3
  const tamanho = await (opcoes.obterTamanho ?? (async (caminho) => (await stat(caminho)).size))(arquivo)
  if (tamanho > limite) throw new Error('pacote excede o limite')
  const pacote = await (opcoes.ler ?? readFile)(arquivo)
  if (pacote.length > limite) throw new Error('pacote excede o limite')
  return pacote
}

export function prepararAlvo(nome: NomeAlvo, ambiente: Record<string, string | undefined>): AlvoPostgres {
  const valor = ambiente.DATABASE_URL_ADMIN
  if (!valor) throw new Error(`DATABASE_URL_ADMIN ausente para ${nome}`)
  const url = new URL(valor)
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    url.search !== '' || url.hash !== '' || !url.username || !url.password
  ) throw new Error(`URL de ${nome} inválida`)
  const banco = url.pathname.slice(1)
  if (nome === 'local') {
    if (url.hostname !== 'localhost' || url.port !== '5432' || banco !== 'crm' || ambiente.PG_SSL !== 'off') {
      throw new Error('banco local inesperado')
    }
    return {
      nome, host: url.hostname, porta: url.port, banco,
      usuario: decodeURIComponent(url.username), senha: decodeURIComponent(url.password), ssl: false
    }
  }
  if (
    url.hostname !== 'altaria.proxy.rlwy.net' || url.port !== '19413' || banco !== 'railway' ||
    ambiente.PG_SSL !== 'verify' || !ambiente.PG_SSL_CA ||
    ambiente.PG_SSL_NOME_SERVIDOR !== 'postgres.railway.internal'
  ) throw new Error('Railway inesperado')
  return {
    nome, host: url.hostname, porta: url.port, banco,
    usuario: decodeURIComponent(url.username), senha: decodeURIComponent(url.password), ssl: true,
    ca: ambiente.PG_SSL_CA, nomeServidorTls: ambiente.PG_SSL_NOME_SERVIDOR
  }
}

function ambienteDocker(alvo: AlvoPostgres) {
  const herdadas = ['PATH', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT']
  const ambiente: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV }
  for (const nome of herdadas) if (process.env[nome]) ambiente[nome] = process.env[nome]
  ambiente.PGHOST = alvo.nome === 'local' ? 'host.docker.internal' : (alvo.nomeServidorTls ?? alvo.host)
  ambiente.PGPORT = alvo.porta
  ambiente.PGDATABASE = alvo.banco
  ambiente.PGUSER = alvo.usuario
  ambiente.PGPASSWORD = alvo.senha
  ambiente.PGOPTIONS = '-c default_transaction_read_only=on'
  ambiente.PGCONNECT_TIMEOUT = '15'
  if (alvo.ssl) {
    ambiente.PGSSLMODE = 'verify-full'
    ambiente.PGSSLROOTCERT = '/run/secrets/railway-ca.pem'
  } else {
    ambiente.PGSSLMODE = 'disable'
  }
  return ambiente
}

function ambienteDockerSemBanco() {
  const herdadas = ['PATH', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'DOCKER_HOST', 'DOCKER_CONTEXT']
  const ambiente: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV }
  for (const nome of herdadas) if (process.env[nome]) ambiente[nome] = process.env[nome]
  return ambiente
}

interface ProcessoDocker {
  stdout: Readable
  stderr: Readable
  kill(): boolean
  on(evento: 'error', listener: (erro: Error) => void): this
  on(evento: 'close', listener: (codigo: number | null) => void): this
}
type IniciarProcesso = (comando: string, args: string[], opcoes: {
  env: NodeJS.ProcessEnv
  windowsHide: true
  stdio: ['ignore', 'pipe', 'pipe']
}) => ProcessoDocker

interface OpcoesProcessoDocker {
  iniciar?: IniciarProcesso
  timeoutMs?: number
}

export async function executarDocker(
  alvo: AlvoPostgres,
  comando: string[],
  opcoes: OpcoesProcessoDocker = {}
) {
  const { args, env, nomeContainer } = montarExecucaoDocker(alvo, comando)
  const iniciar = opcoes.iniciar ?? spawn
  const timeoutMs = opcoes.timeoutMs ?? 10 * 60 * 1000
  return await new Promise<Buffer>((resolve, reject) => {
    const filho = iniciar('docker', args, {
      env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    })
    const partes: Buffer[] = []
    let tamanho = 0
    let excedeu = false
    let expirou = false
    let limpezaIniciada = false
    const limparContainer = () => {
      if (limpezaIniciada) return
      limpezaIniciada = true
      const limpeza = iniciar('docker', ['rm', '--force', nomeContainer], {
        env: ambienteDockerSemBanco(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
      })
      limpeza.stdout.resume()
      limpeza.stderr.resume()
      limpeza.on('error', () => {})
    }
    const timeout = setTimeout(() => {
      expirou = true
      limparContainer()
      filho.kill()
    }, timeoutMs)
    filho.stdout.on('data', (parte: Buffer) => {
      tamanho += parte.length
      if (tamanho > LIMITE_COLETA_BYTES) {
        excedeu = true
        limparContainer()
        filho.kill()
        return
      }
      partes.push(parte)
    })
    // Drena stderr para evitar bloqueio, mas nunca o inclui no erro ou no estado.
    filho.stderr.resume()
    filho.on('error', () => {
      clearTimeout(timeout)
      reject(new Error('falha ao iniciar Docker'))
    })
    filho.on('close', (codigo) => {
      clearTimeout(timeout)
      if (expirou) return reject(new Error('ferramenta excedeu o tempo limite'))
      if (excedeu) return reject(new Error('coleta excede 64 MiB'))
      if (codigo !== 0) return reject(new Error('ferramenta de backup falhou'))
      resolve(Buffer.concat(partes, tamanho))
    })
  })
}

export function montarExecucaoDocker(alvo: AlvoPostgres, comando: string[]) {
  const nomeContainer = `crm-backup-${randomBytes(8).toString('hex')}`
  const args = ['run', '--rm', '--name', nomeContainer]
  if (alvo.enderecoProxy && alvo.nomeServidorTls) args.push('--add-host', `${alvo.nomeServidorTls}:${alvo.enderecoProxy}`)
  if (alvo.ca) args.push('--volume', `${alvo.ca}:/run/secrets/railway-ca.pem:ro`)
  for (const nome of [
    'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGSSLROOTCERT',
    'PGOPTIONS', 'PGCONNECT_TIMEOUT'
  ]) {
    args.push('-e', nome)
  }
  args.push('postgres:18', ...comando)
  return { args, env: ambienteDocker(alvo), nomeContainer }
}

export function criarColetorDocker(alvo: AlvoPostgres): ColetorBackup {
  return {
    nome: alvo.nome,
    coletar: async () => ({
      banco: await executarDocker(alvo, ['pg_dump', '--format=custom']),
      papeis: await executarDocker(alvo, ['pg_dumpall', '--roles-only', '--no-role-passwords'])
    })
  }
}
