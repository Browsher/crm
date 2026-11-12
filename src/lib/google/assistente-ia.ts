import type { PlanoEntrada } from '@/src/features/google/tipos'
import type { PublicoSugerido, RegiaoAssistente, SugestoesBusca } from '@/src/lib/assistente-ia'
import { criteriosVazios, type CriteriosGoogle } from './criterios'

export type SugestaoGoogle = PublicoSugerido & {
  nicho: string
  termos?: string
  produtos?: string
  excluir?: string
  tipos?: CriteriosGoogle['tipos']
}

export type SugestoesGoogle = SugestoesBusca<SugestaoGoogle>

export function aplicarSugestaoAoPlano(plano: PlanoEntrada, sugestao: SugestaoGoogle, regioes?: RegiaoAssistente[]): Partial<PlanoEntrada> {
  const criterios = { ...(plano.criterios ?? criteriosVazios()) }
  if (sugestao.tipos?.length) criterios.tipos = sugestao.tipos
  for (const campo of ['termos', 'produtos', 'excluir'] as const) {
    const texto = sugestao[campo]?.trim()
    if (texto) criterios[campo] = texto
  }
  const regiao = regioes?.[0]
  return {
    nicho: sugestao.nicho,
    ...(regioes && { uf: regiao?.estado ?? '', cidade: regiao?.cidade ?? '', bairro: regiao?.bairros[0] ?? '' }),
    criterios,
  }
}
