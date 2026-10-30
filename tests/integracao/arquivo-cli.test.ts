import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { criarBancoDeTeste, type BancoDeTeste } from './ajuda'
let banco: BancoDeTeste
beforeAll(async () => { banco = await criarBancoDeTeste() })
afterAll(async () => { await banco?.derrubar() })
const executar = promisify(execFile)
test('CLI simula sem mutação, exige backup íntegro e confirmação exata; aplicar novamente é consultivo', async () => {
  const [{ id }] = await banco.sql<{ id: string }>("INSERT INTO empresa(razao_social,telefone) VALUES('CLI sintética','11999998888') RETURNING id")
  const [{ id: grupo }] = await banco.sql<{ id: string }>("INSERT INTO grupo_importacao(nome) VALUES('CLI sintética') RETURNING id")
  await banco.sql('INSERT INTO grupo_importacao_empresa(grupo_id,empresa_id) VALUES($1,$2)', [grupo,id])
  const pasta = resolve('.superpowers/sdd/limpeza-legado-2026-10-30/ensaios',randomUUID())
  await mkdir(pasta,{ recursive: true })
  const manifesto = resolve(pasta,'manifesto.json')
  const backup = resolve(pasta,'backup.json')
  const cli = (...args: string[]) => executar(process.execPath,[resolve('node_modules/tsx/dist/cli.mjs'),resolve('scripts/empresas/arquivar-legado.mts'),...args], { env: { ...process.env, DATABASE_URL_ADMIN: banco.urlAdmin, PG_SSL: 'off' }, maxBuffer: 100_000 })
  const comum = ['--ensaio-local','--manifesto',manifesto,'--backup',backup]
  await cli('--simular','--grupos',grupo,...comum)
  expect(await banco.sql('SELECT * FROM empresa_arquivo')).toEqual([])
  const salvo = JSON.parse(await readFile(manifesto,'utf8')) as { assinatura: string }
  const bytes = await readFile(backup,'utf8')
  await expect(cli('--aplicar',...comum,'--confirmar-sha','0'.repeat(64))).rejects.toBeTruthy()
  await writeFile(backup,bytes.replace('CLI sintética','Backup adulterado'))
  await expect(cli('--aplicar',...comum,'--confirmar-sha',salvo.assinatura)).rejects.toBeTruthy()
  expect(await banco.sql('SELECT * FROM empresa_arquivo')).toEqual([])
  await writeFile(backup,bytes)
  await cli('--aplicar',...comum,'--confirmar-sha',salvo.assinatura)
  expect(await banco.sql('SELECT empresa_id FROM empresa_arquivo')).toEqual([{ empresa_id: id }])
  expect((await cli('--aplicar',...comum,'--confirmar-sha',salvo.assinatura)).stdout).toContain('Operação já aplicada')
})
