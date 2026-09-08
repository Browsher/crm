// Na Vercel o primeiro valor de x-forwarded-for é o cliente. Sem cabeçalho,
// nulo: o limite de tentativas conta só por e-mail.
export function origemDe(headers: Headers): string | null {
  const encaminhado = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (encaminhado) return encaminhado
  const real = headers.get('x-real-ip')?.trim()
  return real || null
}
