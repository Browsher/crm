'use client'
import { useRouter } from 'next/navigation'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
import type { ConfirmacaoContato } from '@/src/features/contato/formulario'
import type { RascunhoContato } from '@/src/features/contato/rascunho'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
import type { FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import type { Contato } from '@/src/features/contato/historico'
import { FormularioContato } from '@/src/features/contato/formulario'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { Cartao } from './cartao'
import { useRascunhos } from './rascunhos'

export type PropsFormulario = {
  empresa: ResumoEmpresa
  fase: 'inicial' | 'negociacao' | 'cliente'
  contatos: Contato[]
  filtros: FiltrosPessoais
  lateral?: {
    destinoAcoes: HTMLElement | null
    aoEditar: (valor: RascunhoContato) => void
    aoSalvar: (navegar?: () => void) => void
    aoMudarEnvio: (pendente: boolean) => void
    aoCancelar: () => void
  }
}

export function Formulario({ empresa, fase, contatos, filtros, lateral }: PropsFormulario) {
  const rascunhos = useRascunhos()
  const router = useRouter()
  function concluir(empresaId: string, confirmacao: ConfirmacaoContato) {
    if (!confirmacao.ok) return
    rascunhos.limpar(empresaId, confirmacao.rascunho)
    const destino = confirmacao.leituraDestino?.ok ? confirmacao.leituraDestino.destino : null
    const navegar = destino?.tipo === 'funil' ? () => router.replace('/funil?negociacao=' + encodeURIComponent(destino.negociacaoId))
      : destino?.tipo === 'sem_interesse' ? () => router.replace(urlPessoal({ ...filtros, disponibilidade: 'sem_interesse' }, 1)) : undefined
    if (lateral) lateral.aoSalvar(navegar)
    else navegar?.()
  }
  return <div className="grid gap-6">{!lateral && <Cartao empresa={empresa} filtros={filtros} />}
    {empresa.id && empresa.versao && empresa.situacao !== 'arquivada' && <section aria-label="Registrar atendimento">{!['a_contatar','sem_interesse','indisponivel'].includes(empresa.situacao) && <h2>Registrar atendimento</h2>}<FormularioContato key={empresa.id} empresaId={empresa.id} versao={empresa.versao} fase={fase} visual="fila" somenteConfirmacao={['a_contatar','sem_interesse','indisponivel'].includes(empresa.situacao)}
      rascunho={rascunhos.entradas[empresa.id]?.valor}
      onDraftChange={valor => {
        rascunhos.atualizar(empresa.id!, empresa.nome, valor)
        lateral?.aoEditar(valor)
      }}
      onSaved={concluir} onPendingChange={lateral?.aoMudarEnvio} onCancel={lateral?.aoCancelar}
      destinoAcoes={lateral?.destinoAcoes} /></section>}
    <LinhaDoTempo contatos={contatos} />
  </div>
}
