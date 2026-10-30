import { lerDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { lerHistorico } from '@/src/features/contato/historico'
import { LinhaDoTempo } from '@/src/features/contato/linha-do-tempo'
import { EmpresaDetalhes } from './empresa-detalhes'
import { Alert } from '@/src/components/ui/alert'
import { CabecalhoPagina } from './cabecalho-pagina'

export async function empresaArquivada(usuarioId: string, empresaId: string) {
  const r = await lerDetalhesEmpresa(usuarioId, { tipo: 'cadastro', empresaId })
  if (!r.ok || r.dados.situacao !== 'arquivada') return null
  const historico = await lerHistorico(usuarioId, empresaId)
  return <section className="grid gap-6">
    <CabecalhoPagina titulo={r.dados.nome} descricao="Arquivo histórico da empresa." />
    <Alert role="note">Arquivada. Somente consulta. Os retornos originais exibidos no histórico foram cancelados na agenda ativa.</Alert>
    <EmpresaDetalhes empresa={r.dados} />
    <section aria-label="Histórico preservado"><h2>Histórico preservado</h2>{historico.ok ? <LinhaDoTempo contatos={historico.contatos} /> : <Alert variant="danger">Não foi possível consultar o histórico.</Alert>}</section>
  </section>
}
