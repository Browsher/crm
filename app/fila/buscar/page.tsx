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
import PaginaGoogle from '../google/page'
import styles from '@/src/components/crm/busca-empresas.module.css'

export default async function PaginaBuscar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const google = params.fonte === 'google'
  if (google) return PaginaGoogle({ searchParams: Promise.resolve(params) })
  const repo = repositorioBusca(eu.usuarioId)
  const [limite, historico, busca] = await Promise.all([repo.meuLimite(), repo.listar(),
    typeof params.busca === 'string' ? repo.ler(params.busca) : Promise.resolve(null)])
  if (typeof params.busca === 'string' && !busca) notFound()
  const configurado = Boolean(process.env.CNPJ_BIZ_API_KEY?.trim())
  const restante = Math.max(0, (limite?.limite_diario ?? 0) - (limite?.usado ?? 0))
  const bloqueado = !configurado || Boolean(limite?.pausado) || restante === 0
  return <main className={styles.pagina} style={{maxWidth:1420,marginInline:'auto'}}>
    <CabecalhoPagina titulo="Banco de empresas" descricao="Encontre novas empresas para os seus grupos." acoes={<><Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button><Button asChild variant="outline"><Link href="#historico-banco">Ver histórico de buscas</Link></Button></>} />
    {process.env.CRM_E2E === '1' && process.env.CNPJ_BIZ_API_KEY === 'chave-apenas-e2e' && <p className={styles.ajuda} role="note">Prévia local com dados fictícios. Consultas simuladas, sem consumo de créditos.</p>}
      <aside aria-label="Seu limite de hoje" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-3 text-sm">
        <p><strong>{limite?.usado ?? 0} de {limite?.limite_diario ?? 0}</strong> empresas solicitadas hoje. {restante} disponíveis.</p>
        <p className={styles.ajuda}>Horário de São Paulo. Consultas com falha também entram no limite.</p>
        {!configurado && <p className={styles.aviso}>Conexão com o banco de empresas pendente de configuração pelo gestor.</p>}
        {limite?.pausado ? <p className={styles.aviso}>Suas buscas estão pausadas pelo gestor.</p> : restante === 0 ? <p className={styles.aviso}>Sem limite disponível. Solicite ao gestor a liberação ou aguarde o próximo dia.</p> : null}
      </aside>
      <FormularioBusca bloqueado={bloqueado} restante={restante} chaveInicial={randomUUID()} buscaConcluidaId={busca?.id} />
      {busca && <Card className={styles.painel}><h2>{busca.nome}</h2>
        <p className={styles.ajuda}>{busca.filtros.palavra || 'CNAE ' + busca.filtros.cnae} · {busca.filtros.uf}{busca.filtros.cidade ? ' / ' + busca.filtros.cidade : ''} · {busca.filtros.quantidade} solicitadas</p>
        {busca.estado === 'reservada' ? <p role="status">Consulta em processamento ou sem confirmação. Atualize esta página para conferir. Ela não será repetida automaticamente.</p>
          : busca.estado === 'falhou' ? <p role="alert">{busca.motivo ? mensagemBusca(busca.motivo) : 'Não foi possível concluir a consulta.'}</p>
          : <ResultadosBusca key={busca.id} busca={busca} bloqueada={Boolean(limite?.pausado)} />}
      </Card>}
      <section id="historico-banco" className="scroll-mt-6"><Card className={styles.painel}><HistoricoBuscas buscas={historico} /></Card></section>
  </main>
}
