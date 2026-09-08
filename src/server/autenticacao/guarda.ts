import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { avaliarAcesso, type Exigencia } from './acesso'
import { COOKIE_SESSAO } from './cookie'
import { lerSessao, type Sessao } from './sessao'

// Uma ida ao banco por requisição: cache() do React deduplica dentro do render.
export const usuarioAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) return null
  return lerSessao(token)
})

// Não apaga cookie inválido: página não pode mexer em cookie. O próximo login
// sobrescreve, ou /sair apaga.
export async function exigir(exigencia: Exigencia): Promise<Sessao> {
  const acesso = avaliarAcesso(await usuarioAtual(), exigencia)
  if (acesso.ok) return acesso.usuario
  redirect(acesso.destino)
}
