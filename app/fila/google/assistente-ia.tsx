'use client'

import { AssistenteIaBusca, AssistenteIaEmBreve } from '@/src/components/crm/assistente-ia-busca'
import type { RegiaoAssistente } from '@/src/lib/assistente-ia'
import type { SugestaoGoogle } from '@/src/lib/google/assistente-ia'
import type { InformarEdicao } from './guarda-edicao'
import { sugerirFiltrosGoogleAcao } from './sugestoes-ia'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  dia: string
  regioesAtuais: RegiaoAssistente[]
  informarEdicao: InformarEdicao
  pedirFechar: () => void
  aoAplicar: (sugestao: SugestaoGoogle, regioes?: RegiaoAssistente[]) => void
}

const ROTULOS = [['nicho', 'Nicho'], ['termos', 'Termos adicionais'], ['produtos', 'Produtos de interesse'], ['excluir', 'Termos a evitar']] as const
const TIPOS = { varejista: 'Varejista', atacadista: 'Atacadista', distribuidor: 'Distribuidor', fabricante: 'Fabricante' }

export function AssistenteIaGoogle({ disponivel, dia, ...props }: Props) {
  if (!disponivel) return <AssistenteIaEmBreve />
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
  return <AssistenteIaBusca {...props} contexto={<span>{data}</span>} limiteRegioes={1} gerarAcao={sugerirFiltrosGoogleAcao}
    orientacao="Preenche o rascunho para você revisar antes de salvar."
    detalhes={sugestao => [
      ...ROTULOS.flatMap(([campo, rotulo]) => sugestao[campo] ? [{ rotulo, valor: sugestao[campo] }] : []),
      ...(sugestao.tipos?.length ? [{ rotulo: 'Tipo de negócio', valor: sugestao.tipos.map(tipo => TIPOS[tipo]).join(', ') }] : []),
    ]} />
}
