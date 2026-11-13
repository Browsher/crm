'use client'

import { useState } from 'react'
import { AssistenteIaBusca, AssistenteIaEmBreve } from '@/src/components/crm/assistente-ia-busca'
import type { RegiaoAssistente } from '@/src/lib/assistente-ia'
import type { CnaeConfirmado, SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import { perfisBancoDoProduto } from '@/src/lib/assistente-ia-cnaes-banco'
import { useGuardaEdicao, type Edicao } from '../google/guarda-edicao'
import { sugerirFiltrosBancoAcao } from './sugestoes-ia'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  regioesAtuais: RegiaoAssistente[]
  aoAplicar: (sugestao: SugestaoBanco, regioes?: RegiaoAssistente[]) => void
}

export function AssistenteIaBanco({ disponivel, ...props }: Props) {
  return disponivel ? <AssistenteBancoAtivo {...props} /> : <AssistenteIaEmBreve />
}

function descreverCnaes(cnaes: CnaeConfirmado[]) {
  return <span className="grid gap-2">{cnaes.map(cnae => <span className="grid gap-1" key={cnae.codigo}>
    <span>{cnae.codigo} · {cnae.descricao}</span>
    {cnae.amplo && <strong>Escopo amplo. Pode incluir empresas de outros segmentos.</strong>}
    {cnae.motivo && <span>{cnae.motivo}</span>}
  </span>)}</span>
}

function AssistenteBancoAtivo({ bloqueado, regioesAtuais, aoAplicar }: Omit<Props, 'disponivel'>) {
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const { pedir, confirmacao } = useGuardaEdicao(null, edicao)
  return <>
    <AssistenteIaBusca bloqueado={bloqueado} regioesAtuais={regioesAtuais} limiteRegioes={20} gerarAcao={sugerirFiltrosBancoAcao}
      informarEdicao={setEdicao} pedirFechar={() => pedir('dialogo')} aoAplicar={aoAplicar}
      orientacao="Preenche o formulário para você revisar antes de buscar."
      perfisBanco={perfisBancoDoProduto}
      detalhes={sugestao => [
        ...(sugestao.cnaes?.length ? [{ rotulo: 'CNAEs principais', valor: descreverCnaes(sugestao.cnaes) }] : []),
        ...(sugestao.cnaesSecundarios?.length ? [{ rotulo: 'CNAEs secundários', valor: descreverCnaes(sugestao.cnaesSecundarios) }] : []),
        ...(sugestao.palavras?.length ? [{ rotulo: 'Palavras na razão social ou nome fantasia', valor: sugestao.palavras.join(', ') }] : []),
      ]} />
    {confirmacao}
  </>
}
