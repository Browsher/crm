import Link from 'next/link'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import { lerDashboard } from '@/src/features/gestao/consulta'
import styles from './gestao.module.css'

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
    <header className={styles.cabecalho}>
      <div><h1>Gestão</h1><p>Acompanhe os retornos e a atividade da sua equipe.</p></div>
      <Button asChild variant="outline"><a href="/gestao">Atualizar</a></Button>
    </header>
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
    <section aria-labelledby="titulo-equipe" className={styles.secao}>
      <div className={styles.cabecalho}><div><h2 id="titulo-equipe">Vendedores ativos</h2><p>Retornos agendados e contatos registrados hoje.</p></div><Badge variant="outline">{dados.vendedores.length} ativos</Badge></div>
      {dados.vendedores.length === 0 ? <div className={styles.vazio}><h3>Nenhum vendedor ativo</h3><p>Gerencie os acessos em Usuários para organizar sua equipe.</p></div> :
        <div className={styles.grade}>{dados.vendedores.map(v => <article key={v.id} aria-label={v.nome} className={styles.card}>
          <header className={styles.vendedor}><span className={styles.avatar} aria-hidden="true">{v.nome.trim().slice(0, 1).toUpperCase()}</span><h3>{v.nome}</h3><Badge variant="success">Ativo</Badge></header>
          <dl className={styles.numeros}>
            <div><dt>Clientes em carteira</dt><dd>{v.clientes}</dd></div>
            <div><dt>Retornos atrasados</dt><dd className={v.atrasados > 0 ? styles.alerta : undefined}>{v.atrasados}</dd></div>
            <div><dt>Retornos hoje</dt><dd>{v.hoje}</dd></div>
          </dl>
          <p className={styles.contatos}>Contatos registrados hoje <strong>{v.contatosHoje}</strong></p>
        </article>)}</div>}
    </section>
    <section aria-labelledby="titulo-atividade" className={styles.secao}>
      <h2 id="titulo-atividade">Atividade recente</h2><p>Últimos registros dos vendedores ativos. Horário de Brasília.</p>
      {dados.atividade.length === 0 ? <div className={styles.vazio}><p>Nenhum contato registrado pelos vendedores ativos.</p></div> :
        <ol className={styles.atividade}>{dados.atividade.map(item => <li key={item.id}>
          <div><strong>{item.vendedor}</strong><p>{item.empresa}</p><span>{Object.hasOwn(tipos, item.tipo) ? tipos[item.tipo] : 'Contato registrado'}</span></div>
          <time dateTime={item.em}>{horario.format(new Date(item.em))}</time>
        </li>)}</ol>}
    </section>
    <nav aria-label="Atalhos administrativos" className={styles.atalhos}>
      <Button asChild variant="outline"><Link href="/empresas">Gerenciar empresas</Link></Button>
      <Button asChild variant="outline"><Link href="/empresas/grupos">Gerenciar grupos</Link></Button>
      <Button asChild variant="outline"><Link href="/usuarios">Gerenciar usuários</Link></Button>
    </nav>
  </main>
}
