import Link from 'next/link'
import { Card } from '@/src/components/ui/card'
import { Button } from '@/src/components/ui/button'
import { ESTADOS_GOOGLE, type PlanoGoogle, type ResultadoGoogle, type ExecucaoGoogle, type LoteGoogle } from '@/src/features/google/tipos'
import { normalizarCriterios } from '@/src/lib/google/criterios'
import { ProspectarGoogle } from './prospectar'
import styles from './google.module.css'

export function DetalheEntrega({ plano, resultados, recibo, execucao = null, lotes = [], gestor = false, contexto = null, pagina = 1, temProxima = false }: { plano: PlanoGoogle; resultados: ResultadoGoogle[]; recibo: Record<string, unknown> | null; execucao?: ExecucaoGoogle | null; lotes?: LoteGoogle[]; gestor?: boolean; contexto?: string | null; pagina?: number; temProxima?: boolean }) {
  const texto = (v: unknown) => typeof v === 'string' ? v : ''
  const estados = { entregue: 'Entregue', repetida: 'Já entregue', indisponivel: 'Com outro responsável', pendente: 'A conferir', conflito: 'Identidade em conflito' }
  const usado = execucao?.snapshot ?? plano.snapshot ?? plano
  const criterios = normalizarCriterios(usado.criterios)
  const nomes: Record<string,string> = {termos:'Termos adicionais',produtos:'Produtos de interesse',tipos:'Tipo de negócio',atendimento:'Forma de atendimento',excluir:'Negócios e termos a evitar',situacao:'Situação no Google',site:'Site próprio',email:'E-mail comercial publicado',telefone:'Tipo de contato',nota:'Nota mínima',avaliacoes:'Mínimo de avaliações',prioridades:'O que priorizar',observacoes:'Outras orientações'}
  const opcoes: Record<string,string> = {varejista:'Varejista',atacadista:'Atacadista',distribuidor:'Distribuidor',fabricante:'Fabricante',priorizar_fisica:'Priorizar loja física',fisica:'Somente loja física',online:'Somente online',ambos:'Loja física e online',priorizar_funcionamento:'Priorizar em funcionamento',funcionamento:'Somente em funcionamento',excluir_encerradas:'Excluir encerradas permanentemente',excluir_fechadas:'Excluir fechadas temporária ou permanentemente',com:'Com',sem:'Sem',whatsapp:'WhatsApp',fixo:'Telefone fixo'}
  const campos = criterios.ok ? Object.entries(criterios.valor).filter(([,v]) => Array.isArray(v) ? v.length > 0 : v !== '' && v !== null) : []
  const valorCriterio = (v: unknown): string => Array.isArray(v) ? v.map(x=>opcoes[String(x)]??String(x)).join(' ou ') : typeof v === 'number' ? new Intl.NumberFormat('pt-BR').format(v) : opcoes[String(v)]??String(v)
  const motivos: Record<string,string> = {meta_atingida:'Meta de 50 empresas atingida',limite_lotes:'Limite de 3 lotes atingido',sem_novidades:'Nenhuma empresa nova encontrada',sem_resultados:'Busca sem resultados',vendedor_inativo:'Vendedor indisponível'}
  return <>
    <Card className={styles.painel}><h2>Histórico da coleta</h2><dl className={styles.resumo}>
      <div><dt>Solicitado por</dt><dd>{plano.vendedor}</dd></div><div><dt>Dia planejado</dt><dd>{plano.dia.split('-').reverse().join('/')}</dd></div>
      <div><dt>Critérios usados</dt><dd>{usado.nicho}, {usado.bairro || 'cidade inteira'}, {usado.cidade}/{usado.uf}</dd></div>
      <div><dt>Situação</dt><dd>{ESTADOS_GOOGLE[plano.estado]}</dd></div><div><dt>Empresas entregues</dt><dd>{plano.entregues} de até 50</dd></div>
      <div><dt>Utilização</dt><dd>{plano.trabalhadas} com atendimento, {Math.max(0, plano.entregues - plano.trabalhadas)} sem atendimento</dd></div>
      {execucao && <><div><dt>Rodadas</dt><dd>{execucao.lotes_reservados} de até 3</dd></div><div><dt>Candidatas analisadas</dt><dd>{execucao.analisadas} de até 150</dd></div><div><dt>Encerramento</dt><dd>{execucao.motivo_parada ? motivos[execucao.motivo_parada] ?? execucao.motivo_parada : 'Em andamento'}</dd></div></>}
    </dl><p className={styles.ajuda}>Utilização considera atendimento registrado pelo destinatário após a entrega. Abrir a ficha não conta como atendimento.</p>
      {campos.length > 0 ? <details><summary className={styles.botaoResumo}>Ver critérios desta busca</summary><dl className={styles.resumo}>{campos.map(([k,v])=><div key={k}><dt>{nomes[k]}</dt><dd>{valorCriterio(v)}</dd></div>)}</dl></details> : <p className={styles.ajuda}>{recibo?.validacao_conferida === true ? 'Entrega legada, com validação de contatos do fluxo anterior.' : 'Entrega direta, sem critérios extras ou validação obrigatória de WhatsApp.'}</p>}
      {plano.motivo && <p role={plano.estado === 'falhou' ? 'alert' : undefined}>{plano.motivo}</p>}
      {gestor && recibo && <div className={styles.acoes}>{['arquivo_original_id', 'arquivo_final_id'].map((campo, i) => typeof recibo[campo] === 'string' && <Button asChild variant="outline" key={campo}><a href={`https://drive.google.com/file/d/${encodeURIComponent(String(recibo[campo]))}/view`} target="_blank" rel="noreferrer">{i === 0 ? 'Arquivo original' : 'Arquivo validado'}</a></Button>)}</div>}
    </Card>
    {gestor && lotes.length > 0 && <Card className={styles.painel}><h2>Rodadas e comprovantes</h2>{lotes.map(l => <div key={l.id}><h3>Rodada {l.ordinal}</h3><p>{l.analisadas} candidatas, {l.resposta?.entregues ?? 0} empresas entregues. {l.concluido_em ? 'Concluída.' : 'Aguardando confirmação.'}</p>{l.recibo && <><div className={styles.acoes}>{['arquivo_original_id','arquivo_resultado_id'].map((k,i) => typeof l.recibo?.[k] === 'string' && <Button key={k} asChild variant="outline"><a href={'https://drive.google.com/file/d/'+encodeURIComponent(String(l.recibo[k]))+'/view'} target="_blank" rel="noreferrer">{i===0?'Arquivo original':'Resultado da rodada'}</a></Button>)}</div><details><summary className={styles.botaoResumo}>Conferir critérios e evidências</summary><pre className={styles.dadosBrutos}>{JSON.stringify({criterios:usado.criterios,evidencias:l.recibo.evidencias},null,2)}</pre></details></>}</div>)}</Card>}
    <section aria-label="Empresas da coleta" className={styles.entregas}>
      {!resultados.length && <Card className={styles.vazio}><h2>Nenhuma empresa liberada nesta entrega</h2><p>Acompanhe o estado da coleta. Resultados pendentes ou já destinados ficam disponíveis ao gestor.</p></Card>}
      {resultados.map(r => <Card className={styles.empresa} key={r.id}>
        <div><span className={styles.situacao}>{estados[r.situacao]}</span><h2>{texto(r.dados.nome_fantasia) || texto(r.dados.razao_social) || 'Empresa sem nome confirmado'}</h2>
          <p>{texto(r.dados.endereco) || 'Endereço não informado pela origem'}</p></div>
        <dl className={styles.resumo}><div><dt>Telefone</dt><dd>{texto(r.dados.telefone) || 'Sem telefone informado'}</dd></div><div><dt>Verificação do contato</dt><dd>{(r.canais_verificados ?? []).includes('whatsapp') || (!r.lote_id && r.dados.validado === true) ? 'WhatsApp confirmado' : (r.canais_verificados ?? []).includes('fixo') ? 'Formato de telefone fixo conferido' : 'Não verificado'}</dd></div><div><dt>CNPJ</dt><dd>{texto(r.dados.cnpj) || 'Não informado'}</dd></div>
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
