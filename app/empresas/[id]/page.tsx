import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerPerfilEmpresa, type PerfilEmpresa } from '@/src/features/empresas/perfil'
import { lerHistorico } from '@/src/features/contato/historico'
import { ResumoVenda } from '@/src/components/crm/resumo-venda'
import { ROTULO, ehTipo } from '@/src/features/contato/tipos'
import { formatarCnpj, formatarTelefone } from '@/src/features/empresas/formato'
import { aplicarFiltrosEmpresas, enderecoEmpresas, lerConsulta } from '@/src/features/empresas/consulta'
import { lerFiltrosEmpresas } from '@/src/features/empresas/filtros'
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card'
import { Badge } from '@/src/components/ui/badge'
import { Alert } from '@/src/components/ui/alert'
import styles from './perfil.module.css'

const situacoes: Record<PerfilEmpresa['situacao'], string> = {
  carteira: 'Em carteira', reservada: 'Reservada', inativa: 'Sem grupo ativo',
  descanso: 'Em descanso', disponivel: 'Disponível para prospecção',
}
const horario = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
function dataCivil(data: string) { return data.split('-').reverse().join('/') }

export default async function PaginaPerfil({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const eu = await exigir('gestor')
  const { id } = await params
  const empresa = await lerPerfilEmpresa(eu.usuarioId, id)
  if (!empresa) notFound()
  const query = await searchParams ?? {}
  const filtros = lerFiltrosEmpresas(query)
  const voltar = filtros.ok ? enderecoEmpresas(aplicarFiltrosEmpresas(lerConsulta(query), filtros.filtros)) : '/empresas'
  const historico = await lerHistorico(eu.usuarioId, id)
  const endereco = empresa.cidade ? [empresa.logradouro, empresa.bairro, `${empresa.cidade}/${empresa.uf}`].filter(Boolean).join(', ')
    : empresa.cep ? `CEP ${empresa.cep}. Endereço não encontrado na base de CEP.` : 'Localização não cadastrada'
  return <main className={styles.pagina}>
    <Link href={voltar} className={styles.voltar}>Voltar para empresas</Link>
    <header className={styles.cabecalho}><div><p>Ficha da empresa</p><h1>{empresa.razaoSocial}</h1>
      <p>{empresa.nomeFantasia ?? 'Nome fantasia não cadastrado'}</p><p>{endereco}</p></div>
      <Badge variant="outline">{situacoes[empresa.situacao]}</Badge></header>
    <div className={styles.colunas}><div className={styles.detalhes}>
      <Card><CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader><CardContent>
        <dl className={styles.dados}>
          <dt>CNPJ</dt><dd>{formatarCnpj(empresa.cnpj)}</dd>
          <dt>Contato</dt><dd>{empresa.contatoNome ?? 'Não informado'}</dd>
          <dt>Telefone</dt><dd>{formatarTelefone(empresa.telefone)}</dd>
          <dt>E-mail</dt><dd>{empresa.email ?? 'Não informado'}</dd>
          <dt>CNAE</dt><dd>{empresa.cnae ?? 'Não informado'}</dd>
          <dt>CEP</dt><dd>{empresa.cep ?? 'Não informado'}</dd>
        </dl>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Acompanhamento</CardTitle></CardHeader><CardContent>
        <dl className={styles.dados}>
          <dt>Vendedor responsável</dt><dd>{empresa.responsavel ?? 'Sem vendedor responsável'}{empresa.responsavel && !empresa.responsavelAtivo ? <Badge variant="warning">Desativado</Badge> : null}</dd>
          {empresa.reservadoPor ? <><dt>Reservada por</dt><dd>{empresa.reservadoPor}</dd><dt>Reserva até</dt><dd>{empresa.reservadoAte ? horario.format(empresa.reservadoAte) : 'Não informado'}</dd></> : null}
          <dt>Próximo passo</dt><dd>{empresa.proximoPasso ?? 'Não registrado'}</dd>
          <dt>Próximo retorno</dt><dd>{empresa.retorno ? dataCivil(empresa.retorno) : 'Sem retorno agendado'}</dd>
        </dl>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Grupos de origem</CardTitle></CardHeader><CardContent>
        {empresa.grupos.length ? <ul className={styles.grupos}>{empresa.grupos.map(g => <li key={g.id}><span>{g.nome}</span><Badge variant={g.ativo ? 'success' : 'outline'}>{g.ativo ? 'Ativo' : 'Desativado'}</Badge></li>)}</ul> : <p>Nenhum grupo vinculado.</p>}
      </CardContent></Card>
    </div><Card><CardHeader><CardTitle>Histórico de atendimentos</CardTitle></CardHeader><CardContent>
      {!historico.ok ? <Alert variant="danger">Não foi possível carregar o histórico. Atualize a página para tentar novamente.</Alert> : !historico.contatos.length ? <p>Nenhum atendimento registrado.</p> :
        <ol className={styles.historico}>{historico.contatos.map(c => <li key={c.id}>
          <div><strong>{c.venda ? 'Venda registrada' : ehTipo(c.tipo) ? ROTULO[c.tipo] : 'Contato registrado'}</strong><time dateTime={c.criadoEm.toISOString()}>{horario.format(c.criadoEm)}</time></div>
          {c.venda ? <ResumoVenda venda={c.venda} /> : null}
          <p>{c.nota ?? 'Sem anotação.'}</p>
          {c.proximoPasso ? <p><strong>Próximo passo:</strong> {c.proximoPasso}{c.proximoPassoData ? ` em ${dataCivil(c.proximoPassoData)}` : ''}</p> : null}
          <p className={styles.autor}>Registrado por {c.autor ?? 'sistema'}</p>
        </li>)}</ol>}
    </CardContent></Card></div>
  </main>
}
