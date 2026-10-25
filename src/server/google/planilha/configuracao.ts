import { createPrivateKey } from 'node:crypto'

export type ConfiguracaoPlanilhaDireta = { planilhaId: string; abaId: number; email: string; chave: string }
export type ConfiguracaoPlanilhaN8n = { transporte: 'n8n'; planilhaId: string; abaId: number; url: string; token: string }
export type ConfiguracaoPlanilha = ConfiguracaoPlanilhaDireta | ConfiguracaoPlanilhaN8n
export function configuracaoPlanilha(env: Record<string, string | undefined> = process.env): ConfiguracaoPlanilha | null {
  const { GOOGLE_PLANILHA_ID: planilhaId, GOOGLE_PLANILHA_ABA_ID: aba, GOOGLE_PLANILHA_CLIENT_EMAIL: email,
    GOOGLE_PLANILHA_PRIVATE_KEY: texto, GOOGLE_PLANILHA_N8N_URL: url, GOOGLE_PLANILHA_N8N_TOKEN: token } = env
  if (!planilhaId || !/^[A-Za-z0-9_-]{1,255}$/.test(planilhaId) || !aba || !/^\d{1,10}$/.test(aba)
    || Number(aba) > 2147483647) return null
  if (url || token) {
    if (!url || url !== url.trim() || !token || !/^[\x21-\x7e]{32,4096}$/.test(token)) return null
    try {
      const endpoint = new URL(url)
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null
    } catch { return null }
    return { transporte: 'n8n', planilhaId, abaId: Number(aba), url, token }
  }
  if (!email || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.gserviceaccount\.com$/.test(email) || !texto) return null
  const chave = texto.replace(/\\n/g, '\n')
  try {
    const privada = createPrivateKey(chave)
    if (privada.asymmetricKeyType !== 'rsa' || (privada.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null
  } catch { return null }
  return { planilhaId, abaId: Number(aba), email, chave }
}
