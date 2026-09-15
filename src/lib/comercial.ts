export const ETAPAS_FUNIL = ['primeiro_contato', 'em_negociacao', 'proposta_enviada'] as const
export type EtapaFunil = typeof ETAPAS_FUNIL[number]

export function proximaEtapa(etapa: string): EtapaFunil | null {
  if (etapa === 'primeiro_contato') return 'em_negociacao'
  if (etapa === 'em_negociacao') return 'proposta_enviada'
  return null
}

export function ehEtapaFunil(valor: string): valor is EtapaFunil {
  return (ETAPAS_FUNIL as readonly string[]).includes(valor)
}
