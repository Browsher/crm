import { chamar } from '../db/sem-identidade'
import type { LinhaBloqueio, LinhaCredencial } from './linhas'
import { hashDescartavel, MAXIMO, verificarSenha } from './senha'
import { criarSessao } from './sessao'

export type ResultadoEntrar =
  | { ok: true; token: string; expiraEm: Date; precisaTrocarSenha: boolean }
  | { ok: false; motivo: 'credenciais_invalidas' }
  | { ok: false; motivo: 'bloqueado'; segundosRestantes: number }

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

const INVALIDAS: ResultadoEntrar = { ok: false, motivo: 'credenciais_invalidas' }
const bloqueado = (b: LinhaBloqueio): ResultadoEntrar => ({ ok: false, motivo: 'bloqueado', segundosRestantes: b.segundos_restantes })

// Ordem importa: bloqueio antes do scrypt; registro depois de saber o resultado.
// E-mail inexistente, senha errada e usuário inativo respondem o mesmo, no
// mesmo tempo: o hash descartável roda quando não há credencial.
export async function entrar(dados: { email: string; senha: string; origem: string | null }): Promise<ResultadoEntrar> {
  const email = normalizarEmail(dados.email)
  const { senha, origem } = dados
  if (!email || !senha || senha.length > MAXIMO) return INVALIDAS

  const [antes] = await chamar<'bloqueio_login', LinhaBloqueio>('bloqueio_login', [email, origem])
  if (antes.bloqueado) return bloqueado(antes)

  const [credencial] = await chamar<'credencial_por_email', LinhaCredencial>('credencial_por_email', [email])
  const confere = await verificarSenha(senha, credencial?.senha_hash ?? (await hashDescartavel()))
  const sucesso = confere && credencial !== undefined && credencial.ativo

  const [depois] = await chamar<'registrar_tentativa_login', LinhaBloqueio>('registrar_tentativa_login', [email, origem, sucesso])
  if (!sucesso || !credencial) return depois.bloqueado ? bloqueado(depois) : INVALIDAS

  const { token, expiraEm } = await criarSessao(credencial.usuario_id)
  return { ok: true, token, expiraEm, precisaTrocarSenha: credencial.senha_provisoria_pendente }
}
