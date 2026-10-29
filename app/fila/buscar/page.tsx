import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { HistoricoBuscas } from '@/src/components/crm/historico-buscas'
import { HistoricoBuscasDialogo } from '@/src/components/crm/historico-buscas-dialogo'
import { EmpresasBancoRecentes } from './empresas-recentes'
import { lerResumosEmpresas, lerResumosBusca } from '@/src/server/atendimento/consulta'
import { FormularioBusca } from './formulario'
import { BuscaDialogo } from '@/src/components/crm/busca-dialogo'
import { ConteudoBusca } from '../../empresas/busca/conteudo'
import { lerDetalheBuscaAcao } from '../../empresas/busca/detalhe-acao'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import PaginaGoogle from '../google/page'
import styles from '@/src/components/crm/busca-empresas.module.css'

export default async function PaginaBuscar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const google = params.fonte === 'google'
  if (google) return PaginaGoogle({ searchParams: Promise.resolve(params) })
  const repo = repositorioBusca(eu.usuarioId)
  const [limite, historico, busca, recentes] = await Promise.all([repo.meuLimite(), repo.listar(),
    typeof params.busca === 'string' ? repo.ler(params.busca) : Promise.resolve(null),
    repo.empresasRecentes().then(empresas => ({ ok: true as const, empresas })).catch(() => ({ ok: false as const }))])
  if (typeof params.busca === 'string' && !busca) notFound()
  const [resumosRecentes, resumosBusca] = await Promise.all([
    lerResumosEmpresas(eu.usuarioId, recentes.ok ? recentes.empresas.slice(0, 11).flatMap(e => e.empresaId ? [e.empresaId] : []) : []),
    busca ? lerResumosBusca(eu.usuarioId, busca.id) : Promise.resolve({ ok: true as const, empresas: [] }),
  ])
  const configurado = Boolean(process.env.CASA_DOS_DADOS_API_KEY?.trim())
  const restante = Math.max(0, (limite?.limite_diario ?? 0) - (limite?.usado ?? 0))
  const bloqueado = !configurado || Boolean(limite?.pausado) || restante === 0
  return <main className={styles.pagina} style={{maxWidth:1420,marginInline:'auto'}}>
    <CabecalhoPagina titulo="Banco de empresas" descricao="Encontre novas empresas para os seus grupos." acoes={<><Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button><HistoricoBuscasDialogo><HistoricoBuscas buscas={historico} /></HistoricoBuscasDialogo><Button asChild variant="outline"><Link href="/fila/localizar?origem=banco">Localizar todas as empresas</Link></Button></>} />
    {process.env.CRM_E2E === '1' && process.env.CASA_DOS_DADOS_API_KEY === 'chave-apenas-e2e' && <p className={styles.ajuda} role="note">Prévia local com dados fictícios. Consultas simuladas, sem consumo de créditos.</p>}
      <aside aria-label="Seu limite de hoje" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3 text-sm">
        <p><strong>{limite?.usado ?? 0} de {limite?.limite_diario ?? 0}</strong> empresas solicitadas hoje. {restante} disponíveis.</p>
        <p className={styles.ajuda}>Horário de São Paulo. Consultas com falha também entram no limite.</p>
        {!configurado && <p className={styles.aviso}>Conexão com o banco de empresas pendente de configuração pelo gestor.</p>}
        {limite?.pausado ? <p className={styles.aviso}>Suas buscas estão pausadas pelo gestor.</p> : restante === 0 ? <p className={styles.aviso}>Sem limite disponível. Solicite ao gestor a liberação ou aguarde o próximo dia.</p> : null}
      </aside>
      {params.inclusao === 'pendente' && <p role="alert">Sua pesquisa ficou salva. A inclusão automática ficou pendente; use Concluir inclusão nos resultados, sem refazer a busca.</p>}
      <FormularioBusca bloqueado={bloqueado} restante={restante} chaveInicial={randomUUID()} buscaConcluidaId={busca?.id} />
      {busca && <Card className={styles.painel}><h2>{busca.nome}</h2>
        <p className={styles.ajuda}>{busca.filtros.quantidade} solicitadas · {busca.empresas.length} retornadas. Confira os resultados no pop-up.</p>
        <BuscaDialogo key={busca.id} nome={busca.nome} rotulo="Ver resultados" abrirInicialmente
          conteudoInicial={<ConteudoBusca busca={busca} gestor={false} bloqueada={Boolean(limite?.pausado)} resumos={resumosBusca.ok ? resumosBusca.empresas : []} />}
          carregarAcao={lerDetalheBuscaAcao.bind(null, busca.id)} />
      </Card>}
      <section id="historico-banco" className="scroll-mt-6"><Card className={styles.painel}>
        {recentes.ok ? <EmpresasBancoRecentes key={recentes.empresas.slice(0, 11).map(e => e.id).join(',')} empresas={recentes.empresas.slice(0, 11)} resumos={resumosRecentes.ok ? resumosRecentes.empresas : []} />
          : <p role="alert">Não foi possível carregar suas empresas recentes. Atualize a página para tentar novamente.</p>}
      </Card></section>
  </main>
}
