'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESSAO, opcoesCookie } from '@/src/server/autenticacao/cookie'
import { entrar } from '@/src/server/autenticacao/entrar'
import { mensagemDeLogin } from '@/src/server/autenticacao/mensagens'
import { origemDe } from '@/src/server/autenticacao/origem'

export type EstadoLogin = { erro: string | null }

export async function entrarAcao(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const r = await entrar({
    email: String(form.get('email') ?? ''),
    senha: String(form.get('senha') ?? ''),
    origem: origemDe(await headers()),
  })
  if (!r.ok) return { erro: mensagemDeLogin(r) }
  ;(await cookies()).set(COOKIE_SESSAO, r.token, opcoesCookie(r.expiraEm))
  redirect(r.precisaTrocarSenha ? '/trocar-senha' : '/')
}
