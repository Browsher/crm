import { readFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { parseEnv } from 'node:util'

export async function lerAmbiente(caminho: string) {
  const texto = await readFile(caminho, 'utf8')
  return parseEnv(texto)
}

export async function lerChaveDaEntrada() {
  const partes: Buffer[] = []
  let tamanho = 0
  for await (const parte of process.stdin) {
    tamanho += parte.length
    if (tamanho > 256) throw new Error('entrada de chave inválida')
    partes.push(parte)
  }
  return interpretarChave(Buffer.concat(partes).toString('utf8'))
}

export function interpretarChave(entrada: string) {
  const texto = entrada.trim()
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(texto)) throw new Error('chave inválida')
  const chave = Buffer.from(texto, 'base64')
  if (chave.length !== 32 || chave.toString('base64') !== texto) throw new Error('chave inválida')
  return chave
}

type ResolverSistema = (
  host: string,
  opcoes: { family: 4 }
) => Promise<{ address: string; family: number }>

export async function resolverIpv4(host: string, resolver: ResolverSistema = lookup) {
  return (await resolver(host, { family: 4 })).address
}
