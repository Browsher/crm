'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE_SESSAO } from '@/src/server/autenticacao/cookie'
import { mensagemDeTroca } from '@/src/server/autenticacao/mensagens'
import { trocarSenha } from '@/src/server/autenticacao/trocar-senha'

export type EstadoTroca = { erro: string | null }

export async function trocarSenhaAcao(_anterior: EstadoTroca, form: FormData): Promise<EstadoTroca> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value
  if (!token) redirect('/login')
  const r = await trocarSenha({
    token,
    senhaAtual: String(form.get('senhaAtual') ?? ''),
    senhaNova: String(form.get('senhaNova') ?? ''),
  })
  if (!r.ok) {
    if (r.motivo === 'sem_sessao') redirect('/login')
    return { erro: mensagemDeTroca(r) }
  }
  redirect('/')
}
