import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { hojeEmSaoPaulo, semanaDe } from '@/src/features/google/regras'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { PlanejamentoSemanal } from './planejamento'
import { ListaEntregas, NavegacaoSemana } from './entregas'
import styles from './google.module.css'

export default async function PaginaGoogle({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  const hoje = hojeEmSaoPaulo()
  const dias = semanaDe(typeof params.semana === 'string' ? params.semana : hoje)
  if (!dias) return <main className={styles.pagina}><h1>Semana inválida</h1><Button asChild><Link href="/fila/google">Ver planejamento</Link></Button></main>
  const repo = repositorioGoogle(eu.usuarioId)
  const [planos, agentes, historico] = await Promise.all([repo.semana(dias[0], dias[4]), repo.agentes(), repo.historicoPlanejamento()])
  const entregas = params.aba === 'entregas'
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Buscas no Google" descricao="Planeje as buscas por nicho e região e acompanhe as entregas." acoes={<Button asChild variant="outline"><Link href="/fila">Voltar às opções</Link></Button>} />
    {process.env.CRM_E2E === '1' && <p className={styles.aviso} role="note">Prévia com dados fictícios. Nenhuma coleta real foi disparada.</p>}
    {agentes[0]?.pausado && <p role="status" className={styles.aviso}>Novas buscas pausadas pelo gestor. A execução iniciada pode concluir.</p>}
    {entregas ? <><NavegacaoSemana inicio={dias[0]} fim={dias[4]} caminho="/fila/google" parametros={{ aba: 'entregas' }} /><ListaEntregas planos={planos} /><Button asChild variant="outline"><Link href="/fila/google">Voltar ao planejamento</Link></Button></>
      : <PlanejamentoSemanal key={dias[0]} dias={dias} planos={planos} hoje={hoje} historico={historico} />}
    <div className={styles.orientacao}><div><strong>Suas buscas, suas empresas</strong><p>Às 17h o agente prepara o próximo dia útil. Na sexta, prepara segunda-feira. Até 50 empresas entregues, com no máximo 3 lotes de 50 candidatas.</p><p className={styles.ajuda}>Sem critérios extras, a entrega é direta. Dia não definido fica sem coleta.</p></div>
      <Button asChild variant="outline"><Link href="/fila/localizar?origem=google">Consultar empresas do Google</Link></Button></div>
  </main>
}
