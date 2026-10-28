import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import { lerDashboard } from '@/src/features/gestao/consulta'
import styles from './gestao.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/src/components/ui/table'

const tipos: Record<string, string | undefined> = {
  nao_liguei: 'Cadastro descartado sem ligação', nao_atendeu: 'Não atendeu',
  retornar_depois: 'Retorno solicitado', sem_interesse: 'Sem interesse',
  interessado: 'Cliente interessado', acompanhamento: 'Acompanhamento',
}
const horario = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export default async function Gestao() {
  const eu = await exigir('gestor')
  const dados = await lerDashboard(eu.usuarioId)
  if (!dados) return <main className={styles.pagina}><Alert variant="warning">Sem permissão para consultar a equipe.</Alert></main>
  const totais = dados.vendedores.reduce((total, vendedor) => ({
    clientes: total.clientes + vendedor.clientes,
    atrasados: total.atrasados + vendedor.atrasados,
    hoje: total.hoje + vendedor.hoje,
  }), { clientes: 0, atrasados: 0, hoje: 0 })
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Gestão" descricao="Acompanhe os retornos e a atividade da sua equipe." acoes={<Button asChild variant="outline"><a href="/gestao">Atualizar</a></Button>} />
    <section aria-label="Resumo da equipe" className={styles.resumo}>
      {[
        { titulo: 'Retornos atrasados', valor: totais.atrasados, detalhe: 'Pendências dos vendedores ativos', alerta: totais.atrasados > 0 },
        { titulo: 'Retornos hoje', valor: totais.hoje, detalhe: 'Agendados para hoje', alerta: false },
        { titulo: 'Clientes em carteira', valor: totais.clientes, detalhe: 'Com vendedores ativos', alerta: false },
        { titulo: 'Empresas disponíveis', valor: dados.disponiveis, detalhe: 'Prontas para prospecção', alerta: false },
      ].map(item => <div key={item.titulo} className={styles.indicador}>
        <h2>{item.titulo}</h2><strong className={item.alerta ? styles.alerta : undefined}>{item.valor.toLocaleString('pt-BR')}</strong><p>{item.detalhe}</p>
      </div>)}
    </section>
    <div className={styles.paineis}><section aria-labelledby="titulo-equipe" className={styles.secao}>
      <div className={styles.cabecalho}><div><h2 id="titulo-equipe">Vendedores ativos</h2><p>Retornos agendados e contatos registrados hoje.</p></div><Badge variant="outline">{dados.vendedores.length} ativos</Badge></div>
      {dados.vendedores.length === 0 ? <div className={styles.vazio}><h3>Nenhum vendedor ativo</h3><p>Gerencie os acessos em Usuários para organizar sua equipe.</p></div> :
        <Table aria-label="Vendedores ativos" className={`${styles.tabela} crm-registros`}><TableHeader><TableRow><TableHead scope="col">Vendedor</TableHead><TableHead scope="col">Clientes em carteira</TableHead><TableHead scope="col">Retornos atrasados</TableHead><TableHead scope="col">Retornos hoje</TableHead><TableHead scope="col">Contatos registrados hoje</TableHead></TableRow></TableHeader><TableBody>{dados.vendedores.map(v => <TableRow key={v.id}>
          <TableCell data-label="Vendedor"><div className={styles.vendedor}><span className={styles.avatar} aria-hidden="true">{v.nome.trim().slice(0, 1).toUpperCase()}</span><h3>{v.nome}</h3></div></TableCell>
          <TableCell data-label="Clientes em carteira">{v.clientes}</TableCell><TableCell data-label="Retornos atrasados" className={v.atrasados > 0 ? styles.alerta : undefined}>{v.atrasados}</TableCell><TableCell data-label="Retornos hoje">{v.hoje}</TableCell><TableCell data-label="Contatos registrados hoje">{v.contatosHoje}</TableCell>
        </TableRow>)}</TableBody></Table>}
    </section>
    <section aria-labelledby="titulo-atividade" className={styles.secao}>
      <h2 id="titulo-atividade">Atividade recente</h2><p>Últimos registros dos vendedores ativos. Horário de Brasília.</p>
      {dados.atividade.length === 0 ? <div className={styles.vazio}><p>Nenhum contato registrado pelos vendedores ativos.</p></div> :
        <ol className={styles.atividade}>{dados.atividade.map(item => <li key={item.id}>
          <div><strong>{item.vendedor}</strong><p>{item.empresa}</p><span>{Object.hasOwn(tipos, item.tipo) ? tipos[item.tipo] : 'Contato registrado'}</span></div>
          <time dateTime={item.em}>{horario.format(new Date(item.em))}</time>
        </li>)}</ol>}
    </section></div>
  </main>
}
