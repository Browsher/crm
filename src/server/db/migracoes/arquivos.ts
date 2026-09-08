import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type Migracao = { nome: string; conteudo: string; soma: string; corpo: string }

export const PASTA_MIGRACOES = join(process.cwd(), 'db', 'migracoes')

export function somaDe(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex')
}

// Remove o comentário de topo (se houver), o BEGIN; e o COMMIT; das pontas.
// Posicional de propósito: o checador já garantiu a forma do arquivo.
export function corpoDe(conteudo: string): string {
  const linhas = conteudo.split(/\r?\n/)
  while (linhas.length && linhas[0].trim() === '') linhas.shift()
  while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop()
  if (linhas[0]?.startsWith('--')) linhas.shift()
  linhas.shift()
  linhas.pop()
  return linhas.join('\n')
}

export async function lerMigracoes(pasta: string): Promise<Migracao[]> {
  const nomes = (await readdir(pasta)).filter((n) => n.endsWith('.sql')).sort()
  return Promise.all(
    nomes.map(async (nome) => {
      const conteudo = await readFile(join(pasta, nome), 'utf8')
      return { nome, conteudo, soma: somaDe(conteudo), corpo: corpoDe(conteudo) }
    }),
  )
}
