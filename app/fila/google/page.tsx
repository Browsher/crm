import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { hojeEmSaoPaulo, semanaDe } from '@/src/features/google/regras'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { FontesBusca } from '@/src/components/crm/fontes-busca'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { PlanejamentoSemanal } from './planejamento'
import { ListaEntregas, NavegacaoSemana } from './entregas'
import styles from './google.module.css'

export default async function PaginaGoogle({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const hoje = hojeEmSaoPaulo()
  const dias = semanaDe(typeof params.semana === 'string' ? params.semana : hoje)
  if (!dias) return <main className={styles.pagina}><h1>Semana inválida</h1><Button asChild><Link href="/fila/google">Ver semana atual</Link></Button></main>
  const repo = repositorioGoogle(eu.usuarioId)
  const [planos, rotina] = await Promise.all([repo.semana(dias[0], dias[4]), repo.rotina(hoje)])
  const entregas = params.aba === 'entregas'
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Busca no Google" descricao="Planeje a semana. O agente coleta e entrega os leads para você." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar para Prospecção</Link></Button>} />
    <FontesBusca google />
    {process.env.CRM_E2E === '1' && <p className={styles.aviso} role="note">Prévia com dados fictícios. Nenhuma coleta real foi disparada.</p>}
    <div className={styles.orientacao}><div><strong>Seus pedidos, seus leads</strong><p>Rotina de segunda a sexta às 9h, horário de São Paulo. A primeira entrega garante exclusividade para você.</p></div>
      <span className={styles.situacao}>{planos.length} de 5 dias planejados</span></div>
    {!process.env.GOOGLE_AGENTE_TOKEN && <p className={styles.aviso}>Conexão do agente pendente de configuração. Você pode salvar o planejamento; o gestor acompanha a ativação.</p>}
    <NavegacaoSemana inicio={dias[0]} fim={dias[4]} caminho="/fila/google" parametros={{ aba: entregas ? 'entregas' : 'planejamento' }} />
    <nav aria-label="Área do Google" className={styles.abas}>
      <Button asChild variant={!entregas ? 'secondary' : 'outline'}><Link aria-current={!entregas ? 'page' : undefined} href={`/fila/google?semana=${dias[0]}`}>Planejamento semanal</Link></Button>
      <Button asChild variant={entregas ? 'secondary' : 'outline'}><Link aria-current={entregas ? 'page' : undefined} href={`/fila/google?semana=${dias[0]}&aba=entregas`}>Leads recebidos</Link></Button>
    </nav>
    {entregas ? <ListaEntregas planos={planos} /> : <Card className={styles.painel}>
      <div className={styles.tituloPainel}><h2>O que o agente vai procurar</h2><p>Escolha um nicho e uma região por dia. Dia sem pedido fica sem coleta. Na próxima semana, preencha novos critérios.</p></div>
      <PlanejamentoSemanal dias={dias} planos={planos} hoje={hoje} rotinaIniciada={rotina} />
    </Card>}
  </main>
}
