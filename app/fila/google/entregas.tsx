import Link from 'next/link'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { ESTADOS_GOOGLE, type PlanoGoogle } from '@/src/features/google/tipos'
import styles from './google.module.css'

export function ListaEntregas({ planos, gestor = false }: { planos: PlanoGoogle[]; gestor?: boolean }) {
  const entregas = planos.filter(p => p.estado !== 'planejado')
  if (!entregas.length) return <Card className={styles.vazio}><h2>Nenhuma entrega nesta semana</h2><p>Os pedidos salvos entram na rotina diária do agente. Acompanhe aqui a coleta, a validação e os leads liberados.</p></Card>
  return <div className={styles.entregas}>{entregas.map(p => <Card key={p.id} className={styles.entrega}>
    <div><span className={styles.situacao} data-estado={p.estado}>{ESTADOS_GOOGLE[p.estado]}</span><h2>{p.nicho}</h2>
      <p>{[p.bairro || 'Cidade inteira', p.cidade, p.uf].join(', ')}</p><p className={styles.ajuda}><time dateTime={p.dia}>{p.dia.split('-').reverse().join('/')}</time>{gestor ? ` · ${p.vendedor}` : ''}</p></div>
    <div className={styles.indicadores}><strong>{p.entregues} entregues</strong><span>{p.trabalhadas} com atendimento</span><span>{Math.max(0, p.entregues - p.trabalhadas)} sem atendimento</span>
      {gestor && <span>{p.encontradas} encontradas · {p.pendentes} pendentes · {p.indisponiveis} repetidas ou indisponíveis</span>}</div>
    {p.motivo && <p role={p.estado === 'falhou' ? 'alert' : undefined} className={styles.ajuda}>{p.motivo}</p>}
    <Button asChild variant="outline"><Link href={`${gestor ? '/empresas' : '/fila'}/google/${p.id}`}>Ver empresas e histórico</Link></Button>
  </Card>)}</div>
}
export function NavegacaoSemana({ inicio, fim, caminho, parametros = {}, proximos = false }: { inicio: string; fim: string; caminho: string; parametros?: Record<string, string>; proximos?: boolean }) {
  const mover = (dias: number) => {
    const data = new Date(inicio + 'T12:00:00Z')
    data.setUTCDate(data.getUTCDate() + dias)
    const params = new URLSearchParams({ ...parametros, semana: data.toISOString().slice(0, 10) })
    return `${caminho}?${params}`
  }
  return <div className={styles.cabecalhoSemana}>
    <div><h2>{proximos?'Próximos cinco dias úteis':`Semana de ${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}`}</h2><p className={styles.ajuda}>{proximos?`De ${inicio.split('-').reverse().join('/')} a ${fim.split('-').reverse().join('/')}. Dias passados ficam no histórico; novas datas começam vazias.`:'Segunda a sexta. Cada semana tem seu próprio planejamento.'}</p></div>
    <nav aria-label="Semanas" className={styles.acoes}><Button asChild variant="outline"><Link href={mover(-7)}>Semana anterior</Link></Button><Button asChild variant="outline"><Link href={mover(7)}>Próxima semana</Link></Button></nav>
  </div>
}
