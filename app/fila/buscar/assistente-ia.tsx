'use client'

import { useState } from 'react'
import { AssistenteIaBusca, AssistenteIaEmBreve } from '@/src/components/crm/assistente-ia-busca'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import type { RegiaoAssistente } from '@/src/lib/assistente-ia'
import { prepararAplicacaoSugestaoBanco, type CnaeConfirmado, type SelecaoPerfilBanco, type SugestaoBanco } from '@/src/lib/assistente-ia-banco'
import { perfisBancoDoProduto } from '@/src/lib/assistente-ia-cnaes-banco'
import type { FiltrosBanco } from '@/src/lib/banco-empresas'
import { useGuardaEdicao, type Edicao } from '../google/guarda-edicao'
import { RevisaoPerfilBanco } from './revisao-perfil-banco'
import { sugerirFiltrosBancoAcao } from './sugestoes-ia'

type Props = {
  disponivel: boolean
  bloqueado: boolean
  filtrosAtuais: FiltrosBanco
  regioesAtuais: RegiaoAssistente[]
  aoAplicar: (campos: Partial<FiltrosBanco>, regioes?: RegiaoAssistente[]) => void
}

const SELECAO_INICIAL: SelecaoPerfilBanco = { campos: [] }

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

function AssistenteBancoAtivo({ bloqueado, filtrosAtuais, regioesAtuais, aoAplicar }: Omit<Props, 'disponivel'>) {
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const { pedir, confirmacao } = useGuardaEdicao(null, edicao)
  return <>
    <AssistenteIaBusca<SugestaoBanco, SelecaoPerfilBanco> bloqueado={bloqueado} regioesAtuais={regioesAtuais} limiteRegioes={20} gerarAcao={sugerirFiltrosBancoAcao}
      informarEdicao={setEdicao} pedirFechar={() => pedir('dialogo')}
      orientacao="Os filtros escolhidos serão preenchidos no formulário de busca."
      perfisBanco={perfisBancoDoProduto}
      exibirMascote
      revisao={{
        tituloDetalhes: 'Atividade e região',
        selecaoInicial: SELECAO_INICIAL,
        conteudo: (sugestao, selecao, alterar) =>
          <RevisaoPerfilBanco perfil={sugestao.perfilEmpresa} selecao={selecao} alterar={alterar} />,
        preparar: (sugestao, selecao, regioes) => {
          const resultado = prepararAplicacaoSugestaoBanco(filtrosAtuais, sugestao, selecao)
          if (!resultado.ok) return { aplicar: null, aviso: <Alert variant="danger">{resultado.motivo}</Alert> }
          return {
            aplicar: () => aoAplicar(resultado.campos, regioes),
            aviso: resultado.substituicoes.length > 0 && <Alert role="status" variant="warning">
              <AlertTitle>Filtros do rascunho que serão substituídos</AlertTitle>
              <AlertDescription><ul className="list-disc pl-5">{resultado.substituicoes.map(campo => <li key={campo}>{campo}</li>)}</ul></AlertDescription>
            </Alert>,
          }
        },
      }}
      detalhes={sugestao => [
        ...(sugestao.cnaes?.length ? [{ rotulo: 'CNAEs principais', valor: descreverCnaes(sugestao.cnaes) }] : []),
        ...(sugestao.cnaesSecundarios?.length ? [{ rotulo: 'CNAEs secundários', valor: descreverCnaes(sugestao.cnaesSecundarios) }] : []),
        ...(sugestao.palavras?.length ? [{ rotulo: 'Palavras na razão social ou nome fantasia', valor: sugestao.palavras.join(', ') }] : []),
      ]} />
    {confirmacao}
  </>
}
