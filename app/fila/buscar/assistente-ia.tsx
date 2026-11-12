'use client'

import { useState } from 'react'
import { AssistenteIaBusca, AssistenteIaEmBreve } from '@/src/components/crm/assistente-ia-busca'
import type { RegiaoSugerida } from '@/src/lib/assistente-ia'
import type { CnaeConfirmado, SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import { useGuardaEdicao, type Edicao } from '../google/guarda-edicao'
import { sugerirFiltrosBancoAcao } from './sugestoes-ia'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  aoAplicar: (sugestao: SugestaoBanco, regiao?: RegiaoSugerida) => void
}

export function AssistenteIaBanco({ disponivel, ...props }: Props) {
  return disponivel ? <AssistenteBancoAtivo {...props} /> : <AssistenteIaEmBreve />
}

function descreverCnaes(cnaes: CnaeConfirmado[]) {
  return <span className="grid gap-1">{cnaes.map(cnae => <span key={cnae.codigo}>{cnae.codigo} · {cnae.descricao}</span>)}</span>
}

function AssistenteBancoAtivo({ bloqueado, aoAplicar }: Omit<Props, 'disponivel'>) {
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const { pedir, confirmacao } = useGuardaEdicao(null, edicao)
  return <>
    <AssistenteIaBusca bloqueado={bloqueado} gerarAcao={sugerirFiltrosBancoAcao}
      informarEdicao={setEdicao} pedirFechar={() => pedir('dialogo')} aoAplicar={aoAplicar}
      orientacao="Preenche o formulário para você revisar antes de buscar."
      detalhes={sugestao => [
        ...(sugestao.cnaes?.length ? [{ rotulo: 'CNAEs principais', valor: descreverCnaes(sugestao.cnaes) }] : []),
        ...(sugestao.cnaesSecundarios?.length ? [{ rotulo: 'CNAEs secundários', valor: descreverCnaes(sugestao.cnaesSecundarios) }] : []),
        ...(sugestao.palavras?.length ? [{ rotulo: 'Nome ou palavra-chave', valor: sugestao.palavras.join(', ') }] : []),
      ]} />
    {confirmacao}
  </>
}
