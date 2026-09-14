'use client'
import { Etapas } from '@/src/components/crm/etapas'

export type EtapaImportacao = 'enviar' | 'conferir' | 'concluir'
export function EtapasImportacao({ etapa, voltar, bloqueado }: {
  etapa: EtapaImportacao; voltar: () => void; bloqueado: boolean
}) {
  return <Etapas rotulo="Etapas da importação" atual={etapa} itens={[
    { id: 'enviar', rotulo: 'Enviar', acao: etapa === 'conferir' && !bloqueado ? <button type="button" onClick={voltar}>Enviar</button> : undefined },
    { id: 'conferir', rotulo: 'Conferir' },
    { id: 'concluir', rotulo: 'Concluir' },
  ]} />
}
