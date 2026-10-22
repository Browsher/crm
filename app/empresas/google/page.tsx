import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { hojeEmSaoPaulo, semanaDe } from '@/src/features/google/regras'
import { ESTADOS_GOOGLE } from '@/src/features/google/tipos'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import { NativeSelect } from '@/src/components/ui/native-select'
import { ListaEntregas, NavegacaoSemana } from '@/app/fila/google/entregas'
import styles from '@/app/fila/google/google.module.css'

export default async function PaginaGoogleGestor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const params = await searchParams
  const dias = semanaDe(typeof params.semana === 'string' ? params.semana : hojeEmSaoPaulo())
  if (!dias) return <main className={styles.pagina}><h1>Semana inválida</h1><Button asChild><Link href="/empresas/google">Ver semana atual</Link></Button></main>
  const vendedor = typeof params.vendedor === 'string' ? params.vendedor : ''
  const estado = typeof params.estado === 'string' && Object.hasOwn(ESTADOS_GOOGLE, params.estado) ? params.estado : ''
  const repo = repositorioGoogle(eu.usuarioId)
  const [todos, vendedores] = await Promise.all([repo.semana(dias[0], dias[4], vendedor), repo.vendedores()])
  const planos = estado ? todos.filter(p => p.estado === estado) : todos
  const total = (campo: 'entregues' | 'trabalhadas' | 'pendentes') => planos.reduce((n, p) => n + p[campo], 0)
  const entregues = total('entregues')
  const trabalhadas = total('trabalhadas')
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Planejamentos e coletas" descricao="Acompanhe o que cada vendedor pediu, recebeu e trabalhou." acoes={<Button asChild variant="outline"><Link href="/empresas/grupos">Ver listas compartilhadas</Link></Button>} />
    {process.env.CRM_E2E === '1' && <p className={styles.aviso} role="note">Prévia com dados fictícios. Nenhuma coleta real foi disparada.</p>}
    <NavegacaoSemana inicio={dias[0]} fim={dias[4]} caminho="/empresas/google" parametros={{ vendedor, estado }} />
    <form className={styles.filtros}>
      <input type="hidden" name="semana" value={dias[0]} />
      <label>Vendedor<NativeSelect name="vendedor" defaultValue={vendedor}><option value="">Todos os vendedores</option>{vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}</NativeSelect></label>
      <label>Situação<NativeSelect name="estado" defaultValue={estado}><option value="">Todas as situações</option>{Object.entries(ESTADOS_GOOGLE).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</NativeSelect></label>
      <Button type="submit">Aplicar filtros</Button>
    </form>
    <dl className={styles.totais}><div><dt>Pedidos na semana</dt><dd>{planos.length}</dd></div><div><dt>Leads entregues</dt><dd>{entregues}</dd></div><div><dt>Com atendimento</dt><dd>{trabalhadas}</dd></div><div><dt>Sem atendimento</dt><dd>{Math.max(0, entregues - trabalhadas)}</dd></div></dl>
    <p className={styles.ajuda}>Atendimento conta quando o destinatário registra uma interação após receber a empresa. Coletas repetidas, conflitos e contatos sem validação ficam no histórico de cada pedido.</p>
    <Card className={styles.painel}><h2>Planejamento dos vendedores</h2>
      {!planos.length ? <p>Nenhum pedido para estes filtros. Cada vendedor precisa preencher os critérios da semana.</p> : <div className={styles.semana}>{planos.map(p => <article className={styles.dia} key={p.id}>
        <div className={styles.data}><strong>{p.vendedor}</strong><time dateTime={p.dia}>{p.dia.split('-').reverse().join('/')}</time></div>
        <div className={styles.criterios}><strong>{p.nicho}</strong><p>{[p.bairro || 'Cidade inteira', p.cidade, p.uf].join(', ')}</p></div>
        <span className={styles.situacao}>{p.estado === 'planejado' && p.dia < hojeEmSaoPaulo() ? 'Não executado' : ESTADOS_GOOGLE[p.estado]}</span>
        <Button asChild variant="outline"><Link href={`/empresas/google/${p.id}`}>Ver pedido</Link></Button>
      </article>)}</div>}
    </Card>
    <h2>Entregas e utilização</h2><ListaEntregas planos={planos} gestor />
  </main>
}
