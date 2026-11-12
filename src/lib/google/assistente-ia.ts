import type { PlanoEntrada } from '@/src/features/google/tipos'
import type { PublicoSugerido, SugestoesBusca } from '@/src/lib/assistente-ia'
import { criteriosVazios } from './criterios'

export type SugestaoGoogle = PublicoSugerido & {
  nicho: string
  termos?: string
  produtos?: string
  excluir?: string
}

export type SugestoesGoogle = SugestoesBusca<SugestaoGoogle>

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
