import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { relative, resolve } from 'node:path'
import { comAdmin } from '../../src/server/db/admin'
import { exigirHostLocal } from '../../src/server/db/host-local'
import { assinaturaArquivo, validarEscopoArquivo, type ManifestoArquivo } from '../../src/lib/arquivo-legado'
import { exigir, lerEnv } from '../../src/server/db/env'

const args = process.argv.slice(2)
const permitidos = new Set(['--simular','--aplicar','--ensaio-local','--grupos','--manifesto','--backup','--confirmar-sha'])
for (let i = 0; i < args.length; i++) {
  if (!permitidos.has(args[i])) throw new Error('Argumento desconhecido.')
  if (!['--simular','--aplicar','--ensaio-local'].includes(args[i])) i++
}
const obter = (nome: string) => { const i = args.indexOf(nome); return i < 0 ? undefined : args[i+1] }
const simular = args.includes('--simular')
if (simular === args.includes('--aplicar')) throw new Error('Escolha --simular ou --aplicar.')
const url = exigir(lerEnv(), 'DATABASE_URL_ADMIN')
const ensaio = args.includes('--ensaio-local')
if (ensaio) exigirHostLocal(url)
function caminhoPrivado(valor: string | undefined): string {
  if (!valor) throw new Error('Informe --manifesto e --backup em diretório privado ignorado pelo Git.')
  const absoluto = resolve(valor)
  const relativo = relative(process.cwd(), absoluto)
  if (relativo.startsWith('..') || absoluto.includes('.git' + '/') || /(?:^|[\\/])\.env(?:[.\\/]|$)/.test(absoluto)) throw new Error('Artefatos devem ficar em diretório privado ignorado dentro do projeto.')
  try { execFileSync('git', ['check-ignore','--quiet','--no-index','--', relativo], { stdio: 'ignore' }) } catch { throw new Error('Manifesto e backup precisam estar ignorados pelo Git.') }
  return absoluto
}
const manifestoPath = caminhoPrivado(obter('--manifesto'))
const backupPath = caminhoPrivado(obter('--backup'))
if (manifestoPath === backupPath) throw new Error('Manifesto e backup exigem arquivos separados.')
const formato = 'crm-arquivo-legado-v1'
if (simular) {
  const grupos = obter('--grupos')?.split(',') ?? []
  if (!grupos.length || grupos.some(g => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(g))) throw new Error('Informe os UUIDs exatos em --grupos separados por vírgula.')
  const manifesto = await comAdmin(url, async c => {
    const r = await c.query<{ m: ManifestoArquivo }>('SELECT arquivo_legado_manifesto($1::uuid[]) AS m', [grupos])
    return r.rows[0].m
  })
  const escopo = validarEscopoArquivo(manifesto, ensaio)
  if (!escopo.ok) throw new Error(escopo.motivo)
  const assinatura = assinaturaArquivo(manifesto)
  const backup = JSON.stringify({ formato, assinatura, geradoEm: new Date().toISOString(), manifesto }, null, 2) + '\n'
  await writeFile(backupPath, backup, { flag: 'wx', mode: 0o600 })
  await writeFile(manifestoPath, JSON.stringify({ formato, assinatura, manifesto }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(`Simulação concluída. Listas: ${manifesto.gruposIds.length}; empresas: ${manifesto.empresasIds.length}. Nenhuma empresa alterada. Confirmação SHA-256: ${assinatura}`)
} else {
  const salvo = JSON.parse(await readFile(manifestoPath, 'utf8')) as { formato: string; assinatura: string; manifesto: ManifestoArquivo }
  const backupBytes = await readFile(backupPath)
  const backup = JSON.parse(backupBytes.toString('utf8')) as typeof salvo
  const escopo = validarEscopoArquivo(salvo.manifesto, ensaio)
  if (!escopo.ok) throw new Error(escopo.motivo)
  const assinatura = assinaturaArquivo(salvo.manifesto)
  if (salvo.formato !== formato || backup.formato !== formato || salvo.assinatura !== assinatura || backup.assinatura !== assinatura || assinaturaArquivo(backup.manifesto) !== assinatura || obter('--confirmar-sha') !== assinatura) throw new Error('Manifesto, backup ou confirmação divergente.')
  const hashBackup = createHash('sha256').update(backupBytes).digest('hex')
  const r = await comAdmin(url, async c => (await c.query<{ r: { ok: true; repetida: boolean } }>('SELECT arquivo_legado_aplicar($1::jsonb,$2) AS r', [salvo.manifesto,hashBackup])).rows[0].r)
  console.log(r.repetida ? 'Operação já aplicada. Nenhuma reativação.' : 'Arquivamento aplicado de forma atômica. Histórico preservado.')
}
