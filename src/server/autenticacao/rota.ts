export const ROTAS_PUBLICAS = ['/login']

// Só presença do cookie. Cookie inválido passa e a página resolve; o proxy
// nunca manda /login para /, senão cookie inválido vira loop.
export function decidirRota(caminho: string, temCookie: boolean): string | null {
  // Este endpoint verifica Bearer e papel no próprio handler, sem sessão de navegador.
  if (caminho === '/api/agente/google') return null
  const publica = ROTAS_PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`))
  if (!temCookie && !publica) return '/login'
  return null
}
