'use client'

import { AssistenteIaBusca, AssistenteIaEmBreve } from '@/src/components/crm/assistente-ia-busca'
import type { SugestaoGoogle, SugestoesGoogle } from '@/src/lib/google/assistente-ia'
import type { InformarEdicao } from './guarda-edicao'
import { sugerirFiltrosGoogleAcao } from './sugestoes-ia'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  dia: string
  informarEdicao: InformarEdicao
  pedirFechar: () => void
  aoAplicar: (sugestao: SugestaoGoogle, regiao: SugestoesGoogle['regiao']) => void
}

const ROTULOS = [['nicho', 'Nicho'], ['termos', 'Termos adicionais'], ['produtos', 'Produtos de interesse'], ['excluir', 'Termos a evitar']] as const

export function AssistenteIaGoogle({ disponivel, dia, ...props }: Props) {
  if (!disponivel) return <AssistenteIaEmBreve />
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(dia + 'T12:00:00Z'))
  return <AssistenteIaBusca {...props} contexto={<span>{data}</span>} gerarAcao={sugerirFiltrosGoogleAcao}
    orientacao="Preenche o rascunho para você revisar antes de salvar."
    detalhes={sugestao => ROTULOS.flatMap(([campo, rotulo]) => sugestao[campo] ? [{ rotulo, valor: sugestao[campo] }] : [])} />
}
