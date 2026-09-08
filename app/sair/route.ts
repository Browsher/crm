import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { encerrarSessao } from '@/src/server/autenticacao/sessao'

// POST, não GET: link de terceiro não desloga ninguém.
export async function POST(request: Request) {
  const armazem = await cookies()
  const token = armazem.get(COOKIE_SESSAO)?.value
  if (token) await encerrarSessao(token)
  armazem.delete(COOKIE_SESSAO)
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
