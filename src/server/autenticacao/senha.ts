import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt do node:crypto, sem biblioteca. Mínimos OWASP: N=2^17, r=8, p=1.
// maxmem PRECISA ser explícito: o padrão do Node é 32 MiB e estes parâmetros
// exigem 128 MiB; sem ele a chamada falha com "Invalid scrypt params".
const N = 2 ** 17
const R = 8
const P = 1
const maxmemPara = (n: number, r: number) => 128 * n * r * 2
const BYTES_SAL = 16
const BYTES_CHAVE = 32

export const MINIMO = 8
// O máximo existe para ninguém mandar um megabyte para o scrypt.
export const MAXIMO = 128

function derivar(senha: string, sal: Buffer, tamanho: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, opcoes, (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)))
  })
}

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(BYTES_SAL)
  const chave = await derivar(senha.normalize('NFKC'), sal, BYTES_CHAVE, { N, r: R, p: P, maxmem: maxmemPara(N, R) })
  return `scrypt$N=${N},r=${R},p=${P}$${sal.toString('base64')}$${chave.toString('base64')}`
}

// Formato com parâmetros dentro: mudar N depois não invalida hash antigo.
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const [algoritmo, parametros, salB64, chaveB64] = hash.split('$')
  if (algoritmo !== 'scrypt' || !parametros || !salB64 || !chaveB64) return false
  const p: Record<string, number> = {}
  for (const par of parametros.split(',')) {
    const [k, v] = par.split('=')
    p[k] = Number(v)
  }
  if (!Number.isInteger(p.N) || !Number.isInteger(p.r) || !Number.isInteger(p.p) || p.N <= 0) return false
  const sal = Buffer.from(salB64, 'base64')
  const esperada = Buffer.from(chaveB64, 'base64')
  if (esperada.length === 0) return false
  let obtida: Buffer
  try {
    obtida = await derivar(senha.normalize('NFKC'), sal, esperada.length, { N: p.N, r: p.r, p: p.p, maxmem: maxmemPara(p.N, p.r) })
  } catch {
    return false
  }
  return obtida.length === esperada.length && timingSafeEqual(obtida, esperada)
}

export type Falta = 'minimo' | 'maximo' | 'so_espaco' | 'igual_atual'

export function validarSenha(senha: string, atual?: string): { ok: true } | { ok: false; faltas: Falta[] } {
  const faltas: Falta[] = []
  if (senha.length < MINIMO) faltas.push('minimo')
  if (senha.length > MAXIMO) faltas.push('maximo')
  if (senha.trim().length === 0) faltas.push('so_espaco')
  if (atual !== undefined && senha === atual) faltas.push('igual_atual')
  return faltas.length ? { ok: false, faltas } : { ok: true }
}

// Sem 0 O 1 l I, para ler de um papel sem confundir.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function gerarSenhaProvisoria(): string {
  const bloco = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
  return `${bloco()}-${bloco()}-${bloco()}`
}

// Hash real de uma senha aleatória, gerado uma vez por processo. Verificado
// quando o e-mail não existe, para o tempo ser o mesmo de uma senha errada.
let descartavel: Promise<string> | undefined
export function hashDescartavel(): Promise<string> {
  descartavel ??= gerarHash(randomBytes(16).toString('hex'))
  return descartavel
}
