import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { hojeEmSaoPaulo, semanaDe, proximosDiasUteis } from '@/src/features/google/regras'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { FontesBusca } from '@/src/components/crm/fontes-busca'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { PlanejamentoSemanal } from './planejamento'
import { ListaEntregas, NavegacaoSemana } from './entregas'
import styles from './google.module.css'
import { configuracaoPlanilha } from '@/src/server/google/planilha/configuracao'

export default async function PaginaGoogle({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const hoje = hojeEmSaoPaulo()
  const entregas = params.aba === 'entregas'
  const movel = !entregas && typeof params.semana !== 'string'
  const semana = semanaDe(typeof params.semana === 'string' ? params.semana : hoje)
  const dias = movel ? proximosDiasUteis(hoje) : semana
  if (!dias) return <main className={styles.pagina}><h1>Semana inválida</h1><Button asChild><Link href="/fila/google">Ver semana atual</Link></Button></main>
  const repo = repositorioGoogle(eu.usuarioId)
  const [planos, rotina, agentes] = await Promise.all([repo.semana(dias[0], dias[4]), repo.rotina(hoje), repo.agentes()])
  const agente = agentes[0]
  const configurado = Boolean(configuracaoPlanilha() && process.env.GOOGLE_AGENTE_TOKEN && process.env.GOOGLE_AGENTE_USUARIO_ID)
  const semanaAtual = semanaDe(hoje)!
  const inicioHistorico = semana?.[0] ?? semanaAtual[0]
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Busca no Google" descricao="Planeje a semana. O agente coleta e entrega os leads para você." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar para Prospecção</Link></Button>} />
    <FontesBusca google />
    {process.env.CRM_E2E === '1' && <p className={styles.aviso} role="note">Prévia com dados fictícios. Nenhuma coleta real foi disparada.</p>}
    <div className={styles.orientacao}><div><strong>Seus pedidos, seus leads</strong><p>Rotina de segunda a sexta às 9h, horário de São Paulo. A primeira entrega garante exclusividade para você.</p></div>
      <span className={styles.situacao}>{planos.length} de 5 dias planejados</span></div>
    <Card className={styles.painel}><h2>Seu agente de busca</h2>
      <p>{agente?.pausado?'Novas buscas pausadas pelo gestor. Uma execução já iniciada pode concluir.':'Seu agente usa os critérios que você salva para cada dia. As buscas da equipe entram em fila no motor compartilhado.'}</p>
      <span className={styles.situacao}>{!configurado?'Aguardando configuração':agente?.pausado?'Novas buscas pausadas':'Vinculado ao seu planejamento'}</span>
      {!configurado && <p className={styles.ajuda}>Você pode salvar os critérios. O gestor precisa configurar a conexão do agente e da planilha para ativar as buscas reais.</p>}
    </Card>
    <NavegacaoSemana inicio={dias[0]} fim={dias[4]} caminho="/fila/google" parametros={{ aba: entregas ? 'entregas' : 'planejamento' }} proximos={movel} />
    {!movel && !entregas && <Button asChild variant="outline"><Link href="/fila/google">Ver próximos cinco dias úteis</Link></Button>}
    <nav aria-label="Área do Google" className={styles.abas}>
      <Button asChild variant={!entregas ? 'secondary' : 'outline'}><Link aria-current={!entregas ? 'page' : undefined} href={movel?'/fila/google':`/fila/google?semana=${inicioHistorico}`}>Planejamento semanal</Link></Button>
      <Button asChild variant={entregas ? 'secondary' : 'outline'}><Link aria-current={entregas ? 'page' : undefined} href={`/fila/google?semana=${inicioHistorico}&aba=entregas`}>Leads recebidos</Link></Button>
    </nav>
    {entregas ? <ListaEntregas planos={planos} /> : <Card className={styles.painel}>
      <div className={styles.tituloPainel}><h2>O que o agente vai procurar</h2><p>Escolha um nicho e uma região por dia. Dia sem pedido fica sem coleta. Os dias passados ficam no histórico e as novas datas começam vazias.</p></div>
      <PlanejamentoSemanal dias={dias} planos={planos} hoje={hoje} rotinaIniciada={rotina} />
    </Card>}
  </main>
}
