import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { decidirRota } from '@/src/server/autenticacao/rota'

export function proxy(request: NextRequest) {
  const destino = decidirRota(request.nextUrl.pathname, request.cookies.has(COOKIE_SESSAO))
  if (!destino) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = destino
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
