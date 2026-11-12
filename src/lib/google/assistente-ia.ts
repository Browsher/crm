import type { PlanoEntrada } from '@/src/features/google/tipos'
import { criteriosVazios } from './criterios'

export const LIMITE_DESCRICAO_IA = 600

export type SugestaoGoogle = {
  titulo: string
  descricao: string
  nicho: string
  termos?: string
  produtos?: string
  excluir?: string
}

export type SugestoesGoogle = {
  regiao?: { cidade: string; uf: string; bairro?: string }
  sugestoes: SugestaoGoogle[]
}

export function aplicarSugestaoAoPlano(plano: PlanoEntrada, sugestao: SugestaoGoogle, regiao?: SugestoesGoogle['regiao']): Partial<PlanoEntrada> {
  const criterios = { ...(plano.criterios ?? criteriosVazios()) }
  for (const campo of ['termos', 'produtos', 'excluir'] as const) {
    const texto = sugestao[campo]?.trim()
    if (texto) criterios[campo] = texto
  }
  return {
    nicho: sugestao.nicho,
    ...(regiao && { cidade: regiao.cidade, uf: regiao.uf, bairro: regiao.bairro ?? '' }),
    criterios,
  }
}
