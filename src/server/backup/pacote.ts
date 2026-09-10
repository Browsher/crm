import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Envelope v1: magic ASCII + versão (1 byte), nonce, ciphertext, tag.
// O cabeçalho também é autenticado como AAD; a versão fixa AES-256-GCM.
const CABECALHO = Buffer.concat([Buffer.from('CRMBACKUP', 'ascii'), Buffer.from([1])])
const BYTES_NONCE = 12
const BYTES_TAG = 16
const INICIO_CONTEUDO = CABECALHO.length + BYTES_NONCE

function validarChave(chave: Buffer): void {
  if (chave.length !== 32) throw new Error('Chave de backup deve ter 32 bytes')
}

export function cifrar(conteudo: Buffer, chave: Buffer): Buffer {
  validarChave(chave)
  const nonce = randomBytes(BYTES_NONCE)
  const cifra = createCipheriv('aes-256-gcm', chave, nonce, { authTagLength: BYTES_TAG })
  cifra.setAAD(CABECALHO)
  const cifrado = Buffer.concat([cifra.update(conteudo), cifra.final()])
  return Buffer.concat([CABECALHO, nonce, cifrado, cifra.getAuthTag()])
}

export function decifrar(pacote: Buffer, chave: Buffer): Buffer {
  validarChave(chave)
  if (pacote.length < INICIO_CONTEUDO + BYTES_TAG || !pacote.subarray(0, CABECALHO.length).equals(CABECALHO)) {
    throw new Error('Pacote de backup inválido ou versão não suportada')
  }
  const nonce = pacote.subarray(CABECALHO.length, INICIO_CONTEUDO)
  const decifra = createDecipheriv('aes-256-gcm', chave, nonce, { authTagLength: BYTES_TAG })
  decifra.setAAD(pacote.subarray(0, CABECALHO.length))
  decifra.setAuthTag(pacote.subarray(-BYTES_TAG))
  // update produz bytes antes da autenticação: só devolver após final aceitar a tag.
  const conteudo = decifra.update(pacote.subarray(INICIO_CONTEUDO, -BYTES_TAG))
  try {
    return Buffer.concat([conteudo, decifra.final()])
  } catch {
    throw new Error('Falha de autenticação do backup')
  } finally {
    conteudo.fill(0)
  }
}

const NOME = /^crm-backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-[0-9a-f]+\.crmbackup$/

function nomeProprio(nome: string): boolean {
  const partes = NOME.exec(nome)
  if (!partes || partes[0] !== nome) return false
  const iso = `${partes[1]}T${partes[2]}:${partes[3]}:${partes[4]}.${partes[5]}Z`
  const data = new Date(iso)
  return Number.isFinite(data.getTime()) && data.toISOString() === iso
}

// O chamador deve fornecer apenas cópias já validadas e confirmadas remotamente.
// Esta função seleciona nomes; não verifica arquivos nem autoriza exclusão sozinha.
export function selecionarExpirados(nomes: string[], manter: number): string[] {
  if (!Number.isSafeInteger(manter) || manter < 1) throw new Error('Retenção deve ser um inteiro positivo')
  // O timestamp UTC de largura fixa vem antes do identificador: ordem lexical = cronológica.
  const proprios = nomes.filter(nomeProprio).sort()
  return proprios.slice(0, Math.max(0, proprios.length - manter))
}
