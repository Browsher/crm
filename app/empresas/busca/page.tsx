import type { FiltrosBusca } from '@/src/features/busca-empresas/tipos'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { mensagemBusca } from '@/src/features/busca-empresas/mensagens'
import { HistoricoBuscas } from '@/src/components/crm/historico-buscas'
import { EmpresaEncontradaDetalhes } from '@/src/components/crm/empresa-encontrada'
import { FormularioLimite } from './limite'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { Card } from '@/src/components/ui/card'
import styles from '@/src/components/crm/busca-empresas.module.css'

const rotulos: Record<keyof FiltrosBusca, string> = { palavra: 'Palavra no nome', cnae: 'CNAE principal', uf: 'UF', cidade: 'Cidade', bairro: 'Bairro', porte: 'Porte', tipo: 'Estabelecimento', contato: 'Contato disponível', quantidade: 'Quantidade solicitada', offset: 'Resultados pulados' }
const valores: Record<string, string> = { telefoneoucelular: 'Telefone ou celular', telefoneoucelulareemail: 'Telefone ou celular e email', email: 'Email', telefoneoucelularouemail: 'Telefone, celular ou email' }
export default async function PaginaGestaoBusca({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('gestor')
  const params = await searchParams
  const repo = repositorioBusca(eu.usuarioId)
  const [limites, historico, busca] = await Promise.all([repo.listarLimites(), repo.listar(),
    typeof params.busca === 'string' ? repo.ler(params.busca) : Promise.resolve(null)])
  if (typeof params.busca === 'string' && !busca) notFound()
  return <main className={styles.pagina}>
    <CabecalhoPagina titulo="Busca de empresas" descricao="Defina os limites de aquisição e acompanhe as buscas dos vendedores." acoes={<Button asChild variant="outline"><Link href="/empresas">Voltar para Empresas</Link></Button>} />
    <Card className={styles.painel}><h2>Conexão CNPJ.biz</h2><p>{process.env.CNPJ_BIZ_API_KEY?.trim() ? 'Chave configurada no servidor.' : 'Configuração pendente. Defina CNPJ_BIZ_API_KEY no ambiente do servidor.'}</p>
      <p className={styles.ajuda}>O limite do CRM conta empresas solicitadas e não representa o saldo de créditos do fornecedor. A busca Google usa o agente já existente.</p></Card>
    <Card className={styles.painel}><h2>Limites por vendedor</h2><p className={styles.ajuda}>Sem limite configurado, novas consultas ficam bloqueadas. Pausar também impede novas importações daquela busca. O dia segue o horário de São Paulo.</p>
      <div className={styles.limites}>{limites.length ? limites.map(l => <FormularioLimite key={l.usuario_id} limite={l} />) : <p>Nenhum vendedor cadastrado.</p>}</div></Card>
    {busca && <Card className={styles.painel}><h2>{busca.nome}</h2><p>{busca.vendedor} · {busca.filtros.quantidade} solicitadas · {busca.empresas.length} retornadas</p>
      <dl className={styles.criterios}>{Object.entries(busca.filtros).filter(([, v]) => v !== '').map(([k, v]) => <div key={k}><dt>{rotulos[k as keyof FiltrosBusca]}</dt><dd>{k === 'tipo' ? v === '2' ? 'Matriz' : 'Filial' : valores[String(v)] ?? String(v)}</dd></div>)}</dl>
      {busca.estado === 'falhou' && busca.motivo ? <p role="alert">{mensagemBusca(busca.motivo)}</p> : busca.estado === 'reservada' ? <p>Consulta sem confirmação de conclusão.</p> : null}
      <ul>{busca.empresas.map(e => <li key={e.cnpj}><EmpresaEncontradaDetalhes empresa={e} /></li>)}</ul>
      {busca.grupo_id && <Link href={`/empresas/grupos/${busca.grupo_id}`}>Ver grupo importado</Link>}
    </Card>}
    <Card className={styles.painel}><HistoricoBuscas buscas={historico} gestor /></Card>
  </main>
}
