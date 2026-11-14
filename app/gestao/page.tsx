import Link from 'next/link'
import { Card, CardContent } from '@/src/components/ui/card'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Button } from '@/src/components/ui/button'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import { lerDashboard } from '@/src/features/gestao/consulta'
import { lerAtividadeGestao } from '@/src/features/gestao/atividade'
import { FILTROS_ATIVIDADE } from '@/src/lib/atividade-gestao'
import { urlPerfilUsuario, lerRecorteUsuarios } from '@/src/lib/recorte-usuarios'
import { AtividadeRecente } from './atividade/painel'
import { apresentarAtividade } from './atividade/apresentacao'
import styles from './gestao.module.css'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/src/components/ui/table'

export default async function Gestao() {
  const eu = await exigir('gestor')
  const dados = await lerDashboard(eu.usuarioId)
  if (!dados) return <main className={styles.pagina}><Alert variant="danger">Sem permissão para consultar a equipe.</Alert></main>
  const [destaques, falhas] = await Promise.all([
    lerAtividadeGestao(eu.usuarioId, FILTROS_ATIVIDADE, 'destaques'),
    lerAtividadeGestao(eu.usuarioId, FILTROS_ATIVIDADE, 'alerta'),
  ])
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
      ].map(item => <Card key={item.titulo} className={styles.indicador}><CardContent>
        <h2>{item.titulo}</h2><strong className={item.alerta ? styles.alerta : undefined}>{item.valor.toLocaleString('pt-BR')}</strong><p>{item.detalhe}</p>
      </CardContent></Card>)}
    </section>
    <div className={styles.paineis}><Card role="region" aria-labelledby="titulo-equipe" className={styles.secao}><CardContent>
      <div className={styles.cabecalho}><div><h2 id="titulo-equipe">Vendedores ativos</h2><p>Retornos agendados e contatos registrados hoje.</p></div><Badge variant="outline">{dados.vendedores.length} ativos</Badge></div>
      {dados.vendedores.length === 0 ? <EstadoVazio nivelTitulo={3} titulo="Nenhum vendedor ativo" descricao="Gerencie os acessos em Usuários para organizar sua equipe." /> :
        <Table aria-label="Vendedores ativos" className={`${styles.tabela} crm-registros`}><TableHeader><TableRow><TableHead scope="col">Vendedor</TableHead><TableHead scope="col">Clientes em carteira</TableHead><TableHead scope="col">Retornos atrasados</TableHead><TableHead scope="col">Retornos hoje</TableHead><TableHead scope="col">Contatos registrados hoje</TableHead></TableRow></TableHeader><TableBody>{dados.vendedores.map(v => <TableRow key={v.id}>
          <TableCell data-label="Vendedor"><div className={styles.vendedor}><span className={styles.avatar} aria-hidden="true">{v.nome.trim().slice(0, 1).toUpperCase()}</span><h3><Link href={urlPerfilUsuario(v.id, lerRecorteUsuarios({}), undefined, 'gestao')} aria-label={`Ver perfil de ${v.nome}`}>{v.nome}</Link></h3></div></TableCell>
          <TableCell data-label="Clientes em carteira">{v.clientes}</TableCell><TableCell data-label="Retornos atrasados" className={v.atrasados > 0 ? styles.alerta : undefined}>{v.atrasados}</TableCell><TableCell data-label="Retornos hoje">{v.hoje}</TableCell><TableCell data-label="Contatos registrados hoje">{v.contatosHoje}</TableCell>
        </TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    <AtividadeRecente hoje={new Date().toISOString()} destaques={apresentarAtividade(destaques)?.eventos ?? []} alerta={apresentarAtividade(falhas)?.eventos[0]}
      vendedores={dados.vendedores.map(({ id, nome }) => ({ id, nome }))} /></div>
  </main>
}
