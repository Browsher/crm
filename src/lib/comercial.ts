export const ETAPAS_FUNIL = ['primeiro_contato', 'em_negociacao', 'proposta_enviada'] as const
export type EtapaFunil = typeof ETAPAS_FUNIL[number]

export function ehEtapaFunil(valor: string): valor is EtapaFunil {
  return (ETAPAS_FUNIL as readonly string[]).includes(valor)
}
