'use server'

import { lerAtividadeGestao } from '@/src/features/gestao/atividade'
import { filtrosAtividade } from '@/src/lib/atividade-gestao'
import { usuarioAtual } from '@/src/server/autenticacao/guarda'
import { apresentarAtividade } from './apresentacao'

export async function consultarAtividadeAcao(entrada: unknown) {
  const eu = await usuarioAtual()
  if (eu?.papel !== 'gestor' || eu.senhaProvisoriaPendente) return null
  const filtros = filtrosAtividade(entrada)
  return filtros ? apresentarAtividade(await lerAtividadeGestao(eu.usuarioId, filtros)) : null
}
