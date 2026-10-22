import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { ESTADOS_GOOGLE, type PlanoGoogle, type ResultadoGoogle } from '@/src/features/google/tipos'
import { ProspectarGoogle } from './prospectar'
import styles from './google.module.css'

export function DetalheEntrega({ plano, resultados, recibo, gestor = false, contexto = null, pagina = 1, temProxima = false }: { plano: PlanoGoogle; resultados: ResultadoGoogle[]; recibo: Record<string, unknown> | null; gestor?: boolean; contexto?: string | null; pagina?: number; temProxima?: boolean }) {
  const texto = (v: unknown) => typeof v === 'string' ? v : ''
  const estados = { entregue: 'Entregue', repetida: 'Já entregue', indisponivel: 'Com outro responsável', pendente: 'A conferir', conflito: 'Identidade em conflito' }
  return <>
    <Card className={styles.painel}><h2>Histórico da coleta</h2><dl className={styles.resumo}>
      <div><dt>Solicitado por</dt><dd>{plano.vendedor}</dd></div><div><dt>Dia planejado</dt><dd>{plano.dia.split('-').reverse().join('/')}</dd></div>
      <div><dt>Critérios usados</dt><dd>{plano.nicho}, {plano.bairro || 'cidade inteira'}, {plano.cidade}/{plano.uf}</dd></div>
      <div><dt>Situação</dt><dd>{ESTADOS_GOOGLE[plano.estado]}</dd></div><div><dt>Leads entregues</dt><dd>{plano.entregues}</dd></div>
      <div><dt>Utilização</dt><dd>{plano.trabalhadas} com atendimento, {Math.max(0, plano.entregues - plano.trabalhadas)} sem atendimento</dd></div>
    </dl><p className={styles.ajuda}>Utilização considera atendimento registrado pelo destinatário após a entrega. Abrir a ficha não conta como atendimento.</p>
      {plano.motivo && <p role={plano.estado === 'falhou' ? 'alert' : undefined}>{plano.motivo}</p>}
      {gestor && recibo && <div className={styles.acoes}>{['arquivo_original_id', 'arquivo_final_id'].map((campo, i) => typeof recibo[campo] === 'string' && <Button asChild variant="outline" key={campo}><a href={`https://drive.google.com/file/d/${encodeURIComponent(String(recibo[campo]))}/view`} target="_blank" rel="noreferrer">{i === 0 ? 'Arquivo original' : 'Arquivo validado'}</a></Button>)}</div>}
    </Card>
    <section aria-label="Empresas da coleta" className={styles.entregas}>
      {!resultados.length && <Card className={styles.vazio}><h2>Nenhuma empresa liberada nesta entrega</h2><p>Acompanhe o estado da coleta. Resultados pendentes ou já destinados ficam disponíveis ao gestor.</p></Card>}
      {resultados.map(r => <Card className={styles.empresa} key={r.id}>
        <div><span className={styles.situacao}>{estados[r.situacao]}</span><h2>{texto(r.dados.nome_fantasia) || texto(r.dados.razao_social) || 'Empresa sem nome confirmado'}</h2>
          <p>{texto(r.dados.endereco) || 'Endereço não informado pela origem'}</p></div>
        <dl className={styles.resumo}><div><dt>Telefone</dt><dd>{texto(r.dados.telefone) || 'Pendente de validação'}</dd></div><div><dt>CNPJ</dt><dd>{texto(r.dados.cnpj) || 'Não informado'}</dd></div>
          <div><dt>Email</dt><dd>{texto(r.dados.email) || 'Não informado'}</dd></div><div><dt>Atendimento após entrega</dt><dd>{r.trabalhada ? 'Registrado' : 'Sem atendimento registrado'}</dd></div></dl>
        {r.motivo && <p className={styles.ajuda}>{r.motivo}</p>}
        <div className={styles.acoes}>{gestor && r.empresa_id ? <Button asChild variant="outline"><Link href={`/empresas/${r.empresa_id}`}>Ver ficha e histórico</Link></Button>
          : r.situacao === 'entregue' && r.empresa_id ? <ProspectarGoogle pedido={plano.id} empresa={r.empresa_id} contexto={contexto} /> : null}</div>
        {gestor && <details><summary className={styles.botaoResumo}>Conferir dados da origem</summary><pre className={styles.dadosBrutos}>{JSON.stringify(r.dados, null, 2)}</pre></details>}
      </Card>)}
    </section>
    {(pagina > 1 || temProxima) && <nav className={styles.acoes} aria-label="Páginas das empresas da coleta">
      {pagina > 1 && <Button asChild variant="outline"><Link href={`${gestor ? '/empresas' : '/fila'}/google/${plano.id}?pagina=${pagina - 1}`}>Página anterior</Link></Button>}
      <span>Página {pagina}</span>
      {temProxima && <Button asChild variant="outline"><Link href={`${gestor ? '/empresas' : '/fila'}/google/${plano.id}?pagina=${pagina + 1}`}>Próxima página</Link></Button>}
    </nav>}
  </>
}
