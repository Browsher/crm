import { createPrivateKey } from 'node:crypto'

export type ConfiguracaoPlanilha = { planilhaId: string; abaId: number; email: string; chave: string }
export function configuracaoPlanilha(env: Record<string, string | undefined> = process.env): ConfiguracaoPlanilha | null {
  const { GOOGLE_PLANILHA_ID: planilhaId, GOOGLE_PLANILHA_ABA_ID: aba, GOOGLE_PLANILHA_CLIENT_EMAIL: email, GOOGLE_PLANILHA_PRIVATE_KEY: texto } = env
  if (!planilhaId || !/^[A-Za-z0-9_-]{1,255}$/.test(planilhaId) || !aba || !/^\d{1,10}$/.test(aba)
    || Number(aba) > 2147483647 || !email || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.gserviceaccount\.com$/.test(email) || !texto) return null
  const chave = texto.replace(/\\n/g, '\n')
  try {
    const privada = createPrivateKey(chave)
    if (privada.asymmetricKeyType !== 'rsa' || (privada.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null
  } catch { return null }
  return { planilhaId, abaId: Number(aba), email, chave }
}
