export const COOKIE_SESSAO = 'crm_sessao'

export function opcoesCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiraEm,
  }
}
