import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline'
import { isDeepStrictEqual } from 'node:util'
import { conferirComprovante, conferirSolicitacao, hashArquivo, lerJson, salvarImutavel } from './arquivos.mts'
import type { ComprovanteDrive, SolicitacaoDrive } from './coordenador-tipos.mts'
const falha = () => new Error('Download, bytes ou metadados do Drive não confirmados.')
type Fetcher = (url: string, opts?: RequestInit) => Promise<Response>
export async function conferirDownload(url: string, limite: number, sha256: string, fetcher: Fetcher = fetch) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.endsWith('.oaiusercontent.com')) throw falha()
  const r = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(120000) })
  if (r.status !== 200 || !r.body || (r.headers.has('content-length') && Number(r.headers.get('content-length')) !== limite)) throw falha()
  let bytes = 0
  const hash = createHash('sha256')
  const reader = r.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > limite) throw falha()
      hash.update(value)
    }
  } finally { await reader.cancel() }
  const resultado = { bytes, sha256: hash.digest('hex') }
  if (bytes !== limite || resultado.sha256 !== sha256) throw falha()
  return resultado
}
type Referencias = { pasta: { id: string; name: string; parents: string[] }; arquivos: { id: string; name: string; parents: string[]; caminho?: string; url?: string }[] }
export async function conferirDrive(entrada: SolicitacaoDrive, refs: Referencias): Promise<ComprovanteDrive> {
  const s = conferirSolicitacao(entrada)
  if (!refs || !refs.pasta || refs.pasta.name !== s.pastaNome || !isDeepStrictEqual(refs.pasta.parents, [s.pastaPai]) || !Array.isArray(refs.arquivos) || refs.arquivos.length !== s.arquivos.length) throw falha()
  const arquivos: ComprovanteDrive['arquivos'] = []
  for (const a of s.arquivos) {
    if (!isDeepStrictEqual(await hashArquivo(a.caminho), { bytes: a.bytes, sha256: a.sha256 })) throw falha()
    const r = refs.arquivos.filter(f => f.name === a.nome)
    if (r.length !== 1 || !isDeepStrictEqual(r[0].parents, [refs.pasta.id]) || (!!r[0].caminho === !!r[0].url)) throw falha()
    if (r[0].caminho && resolve(r[0].caminho) === resolve(a.caminho)) throw falha()
    const bytes = r[0].caminho ? await hashArquivo(resolve(r[0].caminho)) : await conferirDownload(r[0].url!, a.bytes, a.sha256)
    if (bytes.bytes !== a.bytes || bytes.sha256 !== a.sha256) throw falha()
    arquivos.push({ tipo: a.tipo, nome: a.nome, id: r[0].id, pasta_id: refs.pasta.id, ...bytes, downloadConferido: true })
  }
  return conferirComprovante(s, { associacao: s.associacao, solicitacao_id: s.solicitacao_id, lote_id: s.lote_id, pasta_id: refs.pasta.id, arquivos })
}
async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--solicitacao' || args[2] !== '--saida') throw falha()
  const s = conferirSolicitacao(await lerJson(resolve(args[1])))
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  const linhas = createInterface({ input: process.stdin, terminal: false })
  try {
    let entrada = ''
    for await (const linha of linhas) { entrada += linha; if (entrada.length > 65536) throw falha(); if (linha) break }
    const prova = await conferirDrive(s, JSON.parse(entrada))
    await salvarImutavel(resolve(args[3]), JSON.stringify(prova, null, 2))
    console.log(JSON.stringify({ ok: true, comprovante: resolve(args[3]) }))
  } finally { if (process.stdin.isTTY) process.stdin.setRawMode(false); linhas.close() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Comprovante Drive não confirmado. Preserve a intenção.'); process.exitCode = 1 })
}
