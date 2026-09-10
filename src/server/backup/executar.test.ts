import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, test } from 'vitest'
import { decifrar } from './pacote'
import { interpretarChave, lerAmbiente, resolverIpv4 } from './configuracao'
import {
  executarBackup,
  executarDocker,
  lerPacoteLimitado,
  montarExecucaoDocker,
  prepararAlvo,
  recuperarPacote,
  type ColetorBackup
} from './executar'

const pastas: string[] = []

async function pastaTemporaria() {
  const pasta = await mkdtemp(join(tmpdir(), 'crm-backup-'))
  pastas.push(pasta)
  return pasta
}

afterEach(async () => {
  await Promise.all(pastas.splice(0).map((pasta) => rm(pasta, { recursive: true, force: true })))
})

function coletor(nome: 'local' | 'railway', falhar = false): ColetorBackup {
  return {
    nome,
    coletar: async () => {
      if (falhar) throw new Error('postgres://usuario:segredo@host/banco stderr senha=segredo')
      return { banco: Buffer.from(`dump-${nome}`), papeis: Buffer.from(`roles-${nome}`) }
    }
  }
}

describe('executarBackup', () => {
  test('recusa destino que não existe sem criá-lo', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive-ausente')

    const resultado = await executarBackup({
      destino,
      estado: join(raiz, 'estado'),
      chave: randomBytes(32),
      coletores: [coletor('local')]
    })

    expect(resultado.ok).toBe(false)
    await expect(readdir(destino)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('grava o alvo saudável e registra falha sanitizada do outro', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    await mkdir(destino)

    const resultado = await executarBackup({
      destino,
      estado: join(raiz, 'estado'),
      chave: randomBytes(32),
      coletores: [coletor('local'), coletor('railway', true)],
      agora: () => new Date('2026-09-10T21:00:00.000Z'),
      criarId: () => 'a1b2c3d4'
    })

    expect(resultado.ok).toBe(false)
    expect(resultado.alvos.local?.etapa).toBe('sincronizacao_nao_confirmada')
    expect(resultado.alvos.railway).toEqual({ ok: false, etapa: 'falha', motivo: 'falha_na_coleta' })
    expect(JSON.stringify(resultado)).not.toContain('segredo')
    expect(await readdir(join(destino, 'local'))).toEqual([
      'crm-backup-2026-09-10T21-00-00-000Z-a1b2c3d4.crmbackup'
    ])
    await expect(readdir(join(destino, 'railway'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('publica por renomeação e não deixa temporário', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    const chave = randomBytes(32)
    await mkdir(destino)

    await executarBackup({
      destino,
      estado: join(raiz, 'estado'),
      chave,
      coletores: [coletor('local')],
      criarId: () => 'deadbeef'
    })

    const nomes = await readdir(join(destino, 'local'))
    expect(nomes).toHaveLength(1)
    expect(nomes[0]).not.toContain('.tmp')
    const pacote = await readFile(join(destino, 'local', nomes[0]))
    expect(() => decifrar(pacote, chave)).not.toThrow()
  })

  test('lock existente impede concorrência e permanece intacto', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    const estado = join(raiz, 'estado')
    await mkdir(destino)
    await mkdir(estado)
    await writeFile(join(estado, 'backup.lock'), 'de outra execução')

    const resultado = await executarBackup({
      destino,
      estado,
      chave: randomBytes(32),
      coletores: [coletor('local')]
    })

    expect(resultado).toMatchObject({ ok: false, motivo: 'execucao_em_andamento' })
    expect(await readFile(join(estado, 'backup.lock'), 'utf8')).toBe('de outra execução')
  })

  test('não remove lock que foi substituído durante a execução', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    const estado = join(raiz, 'estado')
    await mkdir(destino)

    await executarBackup({
      destino,
      estado,
      chave: randomBytes(32),
      coletores: [{
        nome: 'local',
        coletar: async () => {
          await writeFile(join(estado, 'backup.lock'), 'lock substituído')
          return { banco: Buffer.from('dump'), papeis: Buffer.from('roles') }
        }
      }]
    })

    expect(await readFile(join(estado, 'backup.lock'), 'utf8')).toBe('lock substituído')
  })

  test('não remove cópias anteriores sem confirmação remota', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    await mkdir(join(destino, 'local'), { recursive: true })
    await writeFile(join(destino, 'local', 'crm-backup-2026-09-01T21-00-00-000Z-aaaaaaaa.crmbackup'), 'antigo')

    await executarBackup({
      destino,
      estado: join(raiz, 'estado'),
      chave: randomBytes(32),
      coletores: [coletor('local')],
      criarId: () => 'bbbbbbbb'
    })

    expect(await readdir(join(destino, 'local'))).toContain(
      'crm-backup-2026-09-01T21-00-00-000Z-aaaaaaaa.crmbackup'
    )
  })

  test('recusa cada coleta que excede 64 MiB', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    await mkdir(destino)
    const grande = Buffer.alloc(64 * 1024 * 1024 + 1)

    const resultado = await executarBackup({
      destino,
      estado: join(raiz, 'estado'),
      chave: randomBytes(32),
      coletores: [{ nome: 'local', coletar: async () => ({ banco: grande, papeis: Buffer.alloc(0) }) }]
    })

    expect(resultado.alvos.local).toEqual({ ok: false, etapa: 'falha', motivo: 'coleta_excede_64_mib' })
  })
})

describe('prepararAlvo', () => {
  test('aceita somente o banco local conhecido', () => {
    const alvo = prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@localhost:5432/crm',
      PG_SSL: 'off'
    })

    expect(alvo).toMatchObject({ nome: 'local', host: 'localhost', porta: '5432', banco: 'crm', ssl: false })
    expect(() => prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'https://admin:senha@localhost:5432/crm',
      PG_SSL: 'off'
    })).toThrow('URL')
    expect(() => prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@localhost:5432/crm?sslmode=disable',
      PG_SSL: 'off'
    })).toThrow('URL')
  })

  test('exige proxy, banco, CA e nome TLS conhecidos da Railway', () => {
    expect(() => prepararAlvo('railway', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@outro.proxy.rlwy.net:19413/railway',
      PG_SSL: 'verify',
      PG_SSL_CA: 'C:\\privado\\ca.pem',
      PG_SSL_NOME_SERVIDOR: 'postgres.railway.internal'
    })).toThrow('Railway inesperado')

    const alvo = prepararAlvo('railway', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@altaria.proxy.rlwy.net:19413/railway',
      PG_SSL: 'verify',
      PG_SSL_CA: 'C:\\privado\\ca.pem',
      PG_SSL_NOME_SERVIDOR: 'postgres.railway.internal'
    })
    expect(alvo).toMatchObject({
      nome: 'railway', host: 'altaria.proxy.rlwy.net', porta: '19413', banco: 'railway',
      ssl: true, nomeServidorTls: 'postgres.railway.internal'
    })
  })

  test('passa segredos ao Docker somente por ambiente herdado', () => {
    const alvo = prepararAlvo('railway', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha-super-secreta@altaria.proxy.rlwy.net:19413/railway',
      PG_SSL: 'verify',
      PG_SSL_CA: 'C:\\privado\\ca.pem',
      PG_SSL_NOME_SERVIDOR: 'postgres.railway.internal'
    })
    alvo.enderecoProxy = '203.0.113.7'

    const execucao = montarExecucaoDocker(alvo, ['pg_dump', '--format=custom'])

    expect(execucao.args.join(' ')).not.toContain('senha-super-secreta')
    expect(execucao.args).toContain('PGPASSWORD')
    expect(execucao.env.PGPASSWORD).toBe('senha-super-secreta')
    expect(execucao.args).toContain('postgres.railway.internal:203.0.113.7')
    expect(execucao.env.PGSSLMODE).toBe('verify-full')
    expect(execucao.env.PGOPTIONS).toBe('-c default_transaction_read_only=on')
    expect(execucao.env.PGCONNECT_TIMEOUT).toBe('15')
    expect(execucao.args).toContain('--name')
    expect(execucao.nomeContainer).toMatch(/^crm-backup-[a-f0-9]{16}$/)
  })

  test('timeout remove forçadamente somente o container nomeado pela coleta', async () => {
    const alvo = prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@localhost:5432/crm',
      PG_SSL: 'off'
    })
    const chamadas: string[][] = []
    const iniciar = (_comando: string, args: string[]) => {
      chamadas.push(args)
      const processo = new EventEmitter() as EventEmitter & {
        stdout: PassThrough
        stderr: PassThrough
        kill(): boolean
      }
      processo.stdout = new PassThrough()
      processo.stderr = new PassThrough()
      processo.kill = () => {
        queueMicrotask(() => processo.emit('close', 143))
        return true
      }
      if (args[0] === 'rm') queueMicrotask(() => processo.emit('close', 0))
      return processo
    }

    const promessa = executarDocker(alvo, ['pg_dump'], { iniciar, timeoutMs: 1 })

    await expect(promessa).rejects.toThrow('tempo limite')
    const nome = chamadas[0][chamadas[0].indexOf('--name') + 1]
    expect(chamadas[1]).toEqual(['rm', '--force', nome])
  })

  test('excesso de saída também remove somente o container da coleta', async () => {
    const alvo = prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@localhost:5432/crm',
      PG_SSL: 'off'
    })
    const chamadas: string[][] = []
    const iniciar = (_comando: string, args: string[]) => {
      chamadas.push(args)
      const processo = new EventEmitter() as EventEmitter & {
        stdout: PassThrough
        stderr: PassThrough
        kill(): boolean
      }
      processo.stdout = new PassThrough()
      processo.stderr = new PassThrough()
      processo.kill = () => {
        queueMicrotask(() => processo.emit('close', 143))
        return true
      }
      if (args[0] === 'run') queueMicrotask(() => processo.stdout.emit('data', { length: 64 * 1024 * 1024 + 1 } as Buffer))
      if (args[0] === 'rm') queueMicrotask(() => processo.emit('close', 0))
      return processo
    }

    await expect(executarDocker(alvo, ['pg_dump'], { iniciar, timeoutMs: 1_000 })).rejects.toThrow('64 MiB')
    const nome = chamadas[0][chamadas[0].indexOf('--name') + 1]
    expect(chamadas[1]).toEqual(['rm', '--force', nome])
  })

  test('pg_dump preserva donos e privilégios', () => {
    const alvo = prepararAlvo('local', {
      DATABASE_URL_ADMIN: 'postgresql://admin:senha@localhost:5432/crm',
      PG_SSL: 'off'
    })

    const execucao = montarExecucaoDocker(alvo, ['pg_dump', '--format=custom'])

    expect(execucao.args.slice(-3)).toEqual(['postgres:18', 'pg_dump', '--format=custom'])
    expect(execucao.args).not.toContain('--no-owner')
    expect(execucao.args).not.toContain('--no-acl')
  })
})

describe('recuperarPacote', () => {
  test('recupera somente os três arquivos fixos após validar hashes', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    const estado = join(raiz, 'estado')
    const recuperado = join(raiz, 'recuperado')
    const chave = randomBytes(32)
    await mkdir(destino)
    await executarBackup({ destino, estado, chave, coletores: [coletor('local')], criarId: () => 'cafebabe' })
    const nome = (await readdir(join(destino, 'local')))[0]

    const resultado = await recuperarPacote(join(destino, 'local', nome), recuperado, chave)

    expect(resultado).toEqual({ ok: true })
    expect((await readdir(recuperado)).sort()).toEqual(['banco.dump', 'manifesto.json', 'papeis.sql'])
    expect(await readFile(join(recuperado, 'banco.dump'), 'utf8')).toBe('dump-local')
  })

  test('recusa pasta de recuperação existente', async () => {
    const raiz = await pastaTemporaria()
    const destino = join(raiz, 'drive')
    const recuperado = join(raiz, 'recuperado')
    const chave = randomBytes(32)
    await mkdir(destino)
    await mkdir(recuperado)
    await executarBackup({ destino, estado: join(raiz, 'estado'), chave, coletores: [coletor('local')] })
    const nome = (await readdir(join(destino, 'local')))[0]

    await expect(recuperarPacote(join(destino, 'local', nome), recuperado, chave)).rejects.toThrow('nova')
  })

  test('recusa pacote grande pelo stat antes de ler e confere novamente após a leitura', async () => {
    let leituras = 0
    await expect(lerPacoteLimitado('grande.crmbackup', {
      obterTamanho: async () => 193 * 1024 * 1024,
      ler: async () => {
        leituras++
        return Buffer.alloc(0)
      }
    })).rejects.toThrow('limite')
    expect(leituras).toBe(0)

    await expect(lerPacoteLimitado('cresceu.crmbackup', {
      obterTamanho: async () => 1,
      ler: async () => ({ length: 193 * 1024 * 1024 }) as Buffer
    })).rejects.toThrow('limite')
  })
})

describe('configuração privada', () => {
  test('lê somente o arquivo solicitado sem herdar variáveis do processo', async () => {
    const raiz = await pastaTemporaria()
    const arquivo = join(raiz, '.env.alvo')
    await writeFile(arquivo, "DATABASE_URL_ADMIN='postgresql://alvo' # comentário\nPG_SSL=verify\nPG_SSL_CA='linha 1\nlinha 2'\n")

    const ambiente = await lerAmbiente(arquivo)

    expect(ambiente).toEqual({
      DATABASE_URL_ADMIN: 'postgresql://alvo',
      PG_SSL: 'verify',
      PG_SSL_CA: 'linha 1\nlinha 2'
    })
    expect(ambiente.PATH).toBeUndefined()
  })

  test('aceita apenas base64 canônico de exatamente 32 bytes', () => {
    const chave = Buffer.alloc(32, 7)
    expect(interpretarChave(`${chave.toString('base64')}\r\n`)).toEqual(chave)
    expect(() => interpretarChave(Buffer.alloc(31).toString('base64'))).toThrow('chave inválida')
    expect(() => interpretarChave('!!!!')).toThrow('chave inválida')
  })

  test('resolve o proxy pelo resolvedor do sistema forçando IPv4', async () => {
    const chamadas: unknown[] = []
    const endereco = await resolverIpv4('altaria.proxy.rlwy.net', async (host, opcoes) => {
      chamadas.push(host, opcoes)
      return { address: '203.0.113.9', family: 4 }
    })

    expect(endereco).toBe('203.0.113.9')
    expect(chamadas).toEqual(['altaria.proxy.rlwy.net', { family: 4 }])
  })
})
