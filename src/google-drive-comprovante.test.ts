import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { afterEach, expect, test } from 'vitest'
import { conferirDownload, conferirDrive } from '../scripts/google/conferir-drive.mts'
import type { SolicitacaoDrive } from '../scripts/google/coordenador-tipos.mts'
const pastas: string[] = []
afterEach(async () => { await Promise.all(pastas.splice(0).map(p => rm(p, { recursive: true, force: true }))) })
const bytes = Buffer.from('fixture\r\n')
const sha = createHash('sha256').update(bytes).digest('hex')
test('confere bytes materializados e metadados sem guardar URL', async () => {
  const pasta = await mkdtemp(resolve(tmpdir(), 'drive-proof-')); pastas.push(pasta)
  const arquivo = resolve(pasta, 'original.csv'), download = resolve(pasta, 'download.csv'); await writeFile(arquivo, bytes); await writeFile(download, bytes)
  const s: SolicitacaoDrive = { associacao: { contrato: 2, vinculo: { motor: '02', executor: randomUUID(), pedido_id: randomUUID(), execucao_id: randomUUID(), vendedor_id: randomUUID(), revisao: 1, snapshot_sha256: 'b'.repeat(64) } }, solicitacao_id: randomUUID(), lote_id: randomUUID(), pastaPai: '11bRM44mz5uPfZ-4r3kWH_6OWiGYqg4Wh', pastaNome: 'teste', arquivos: [{ tipo: 'original', caminho: arquivo, nome: 'original.csv', bytes: bytes.length, sha256: sha }] }
  const refs = { pasta: { id: 'folder_fixture', name: 'teste', parents: [s.pastaPai] }, arquivos: [{ id: 'file_fixture', name: 'original.csv', parents: ['folder_fixture'], caminho: download }] }
  const p = await conferirDrive(s, refs)
  expect(p.arquivos[0].downloadConferido).toBe(true)
  expect(JSON.stringify(p)).not.toContain('caminho')
  await expect(conferirDrive(s, { ...refs, pasta: { ...refs.pasta, parents: ['outra'] } })).rejects.toThrow()
  await writeFile(arquivo, 'divergente')
  await expect(conferirDrive(s, refs)).rejects.toThrow()
})
test('download HTTPS recusa origem externa, redirecionamento e limite de bytes', async () => {
  let chamadas = 0
  const fetcher = async () => { chamadas++; return new Response(bytes) }
  await expect(conferirDownload('https://example.org/token', bytes.length, sha, fetcher)).rejects.toThrow()
  expect(chamadas).toBe(0)
  await expect(conferirDownload('https://file.oaiusercontent.com/x', bytes.length, sha, async () => new Response(null, { status: 302, headers: { location: 'https://example.org' } }))).rejects.toThrow()
  await expect(conferirDownload('https://file.oaiusercontent.com/x', 1, sha, fetcher)).rejects.toThrow()
  expect(await conferirDownload('https://file.oaiusercontent.com/x', bytes.length, sha, fetcher)).toEqual({ bytes: bytes.length, sha256: sha })
})
