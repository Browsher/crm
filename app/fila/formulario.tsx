'use client'
import type { ResumoEmpresa } from '@/src/lib/empresa-visual'
import type { FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import type { Contato } from '@/src/features/contato/historico'
import { FormularioContato } from '@/src/features/contato/formulario'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { Cartao } from './cartao'
import { useRascunhos } from './rascunhos'

export function Formulario({ empresa, fase, contatos, filtros }: { empresa: ResumoEmpresa; fase: 'inicial' | 'negociacao' | 'cliente'; contatos: Contato[]; filtros: FiltrosPessoais }) {
  const rascunhos = useRascunhos()
  return <div className="grid gap-6"><Cartao empresa={empresa} filtros={filtros} />
    {empresa.id && empresa.versao && empresa.situacao !== 'arquivada' && <section aria-label="Registrar atendimento">{!['a_contatar','sem_interesse','indisponivel'].includes(empresa.situacao) && <h2>Registrar atendimento</h2>}<FormularioContato key={empresa.id} empresaId={empresa.id} versao={empresa.versao} fase={fase} visual="fila" somenteConfirmacao={['a_contatar','sem_interesse','indisponivel'].includes(empresa.situacao)}
      rascunho={rascunhos.entradas[empresa.id]?.valor}
      onDraftChange={valor => rascunhos.atualizar(empresa.id!, empresa.nome, valor)}
      onSaved={rascunhos.limpar} /></section>}
    <LinhaDoTempo contatos={contatos} />
  </div>
}
