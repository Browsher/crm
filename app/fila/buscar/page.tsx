import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import { HistoricoBuscas } from '@/src/components/crm/historico-buscas'
import { FormularioBusca } from './formulario'
import { ResultadosBusca } from './resultados'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import styles from '@/src/components/crm/busca-empresas.module.css'

export default async function PaginaBuscar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const google = params.fonte === 'google'
  const repo = repositorioBusca(eu.usuarioId)
  const [limite, historico, grupos, busca] = await Promise.all([repo.meuLimite(), repo.listar(), google ? repo.gruposGoogle() : Promise.resolve([]),
    typeof params.busca === 'string' ? repo.ler(params.busca) : Promise.resolve(null)])
  if (typeof params.busca === 'string' && !busca) notFound()
  const configurado = Boolean(process.env.CNPJ_BIZ_API_KEY?.trim())
  const restante = Math.max(0, (limite?.limite_diario ?? 0) - (limite?.usado ?? 0))
  const bloqueado = !configurado || Boolean(limite?.pausado) || restante === 0
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Buscar empresas" descricao="Escolha a origem e reúna empresas para prospectar." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar para Prospecção</Link></Button>} />
    {process.env.CRM_E2E === '1' && process.env.CNPJ_BIZ_API_KEY === 'chave-apenas-e2e' && <p className={styles.aviso} role="note">Prévia local com dados fictícios. Consultas simuladas, sem consumo de créditos.</p>}
    <nav className={styles.fontes} aria-label="Origem das empresas">
      <Link href="/fila/buscar?fonte=google" aria-current={google ? 'page' : undefined}>Busca no Google</Link>
      <Link href="/fila/buscar?fonte=banco" aria-current={!google ? 'page' : undefined}>Busca do banco de dados</Link>
    </nav>
    {google ? <Card className={styles.painel}><h2>Resultados do agente do Google</h2>
      <p className={styles.ajuda}>Listas já importadas com identificação de origem Google. O agente diário existente continua responsável pela coleta.</p>
      {!grupos.length ? <p>Nenhuma lista com identificadores Google disponível. Confira também as listas já importadas.</p> : <ul>{grupos.map(g => <li key={g.id}>
        <h3>{g.nome}</h3><p>{g.total} empresas de origem Google · Importada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(g.criado_em))}</p>
        <Link href={`/fila?grupo=${g.id}`}>Prospectar esta lista</Link>
      </li>)}</ul>}<Link href="/fila?escolher_lista=1">Ver todas as listas de prospecção</Link>
    </Card> : <>
      <div className={styles.colunas}><Card className={styles.painel}><h2>Buscar no CNPJ.biz</h2>
        <FormularioBusca bloqueado={bloqueado} restante={restante} chaveInicial={randomUUID()} buscaConcluidaId={busca?.id} />
      </Card><aside><Card className={styles.painel}><h2>Seu limite de hoje</h2>
        <p><strong>{limite?.usado ?? 0} de {limite?.limite_diario ?? 0}</strong> empresas solicitadas</p><p>{restante} disponíveis para consultar hoje.</p>
        <p className={styles.ajuda}>Horário de São Paulo. Consultas com falha também entram no limite porque o fornecedor pode ter cobrado.</p>
        {!configurado && <p className={styles.aviso}>Conexão CNPJ.biz pendente de configuração pelo gestor.</p>}
        {limite?.pausado ? <p className={styles.aviso}>Suas buscas estão pausadas pelo gestor.</p> : restante === 0 ? <p className={styles.aviso}>Sem limite disponível. Solicite ao gestor a liberação ou aguarde o próximo dia.</p> : null}
      </Card></aside></div>
      {busca && <Card className={styles.painel}><h2>{busca.nome}</h2>
        <p className={styles.ajuda}>{busca.filtros.palavra || 'CNAE ' + busca.filtros.cnae} · {busca.filtros.uf}{busca.filtros.cidade ? ' / ' + busca.filtros.cidade : ''} · {busca.filtros.quantidade} solicitadas</p>
        {busca.estado === 'reservada' ? <p role="status">Consulta em processamento ou sem confirmação. Atualize esta página para conferir. Ela não será repetida automaticamente.</p>
          : busca.estado === 'falhou' ? <p role="alert">{busca.motivo ? mensagemBusca(busca.motivo) : 'Não foi possível concluir a consulta.'}</p>
          : <ResultadosBusca key={busca.id} busca={busca} bloqueada={Boolean(limite?.pausado)} />}
      </Card>}
      <Card className={styles.painel}><HistoricoBuscas buscas={historico} /></Card>
    </>}
  </main>
}
