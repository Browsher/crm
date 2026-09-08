import { createHash, randomBytes } from 'node:crypto'
import { chamar } from '../db/sem-identidade'
import type { LinhaSessao, Papel } from './linhas'

export const DIAS_VALIDADE = 30

export type Sessao = {
  usuarioId: string
  nome: string
  email: string
  papel: Papel
  senhaProvisoriaPendente: boolean
  expiraEm: Date
}

export function gerarToken(): string {
  return randomBytes(32).toString('base64url')
}

// SHA-256 puro, sem KDF, de propósito. O token tem 256 bits de aleatoriedade;
// KDF lenta (scrypt) serve para entrada de baixa entropia, que é senha humana.
// Aqui só se precisa que ler o hash não dê o token: resistência a pré-imagem.
// scrypt custaria 300ms por requisição para proteção nenhuma. Não "melhorar".
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function criarSessao(usuarioId: string): Promise<{ token: string; expiraEm: Date }> {
  const token = gerarToken()
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 60 * 60 * 1000)
  await chamar('sessao_criar', [usuarioId, hashDoToken(token), expiraEm])
  return { token, expiraEm }
}

export async function lerSessao(token: string): Promise<Sessao | null> {
  const [l] = await chamar<'sessao_atual', LinhaSessao>('sessao_atual', [hashDoToken(token)])
  if (!l) return null
  return {
    usuarioId: l.usuario_id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    senhaProvisoriaPendente: l.senha_provisoria_pendente,
    expiraEm: l.expira_em,
  }
}

export async function encerrarSessao(token: string): Promise<void> {
  await chamar('sessao_encerrar', [hashDoToken(token)])
}
