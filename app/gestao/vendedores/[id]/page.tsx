import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { EMPRESAS_POR_PAGINA, lerPerfilVendedor, paginaDoPerfil } from '@/src/features/gestao/perfil-vendedor'
import { formatarCnpj } from '@/src/features/empresas/formato'
import { ehTipo, ROTULO } from '@/src/features/contato/tipos'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import geral from '../../gestao.module.css'
import styles from './perfil.module.css'

const horario = new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short', timeZone:'America/Sao_Paulo' })
function dataCivil(data: string) { return data.split('-').reverse().join('/') }

export default async function Perfil({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string,string | string[] | undefined>>
}) {
  const eu = await exigir('gestor')
  const { id } = await params
  const query = await searchParams ?? {}
  const dados = await lerPerfilVendedor(eu.usuarioId,id,paginaDoPerfil(query.pagina))
  if (!dados) notFound()
  const paginas = Math.max(1, Math.ceil(dados.clientes / EMPRESAS_POR_PAGINA))
  const endereco = (pagina: number) => `/gestao/vendedores/${dados.id}?pagina=${pagina}`
  return <main className={geral.pagina}>
    <Link href="/gestao" className={styles.voltar}>Voltar para o dashboard</Link>
    <header className={`${geral.cabecalho} ${styles.cabecalho}`}>
      <div><p>Perfil do vendedor</p><h1>{dados.nome}</h1><p>{dados.email}</p></div>
      <div className={styles.acoes}><Badge variant="success">Ativo</Badge><Button asChild variant="outline"><a href={endereco(dados.pagina)}>Atualizar</a></Button></div>
    </header>
    <section aria-label="Resumo do vendedor" className={geral.resumo}>
      {[
        { nome:'Clientes em carteira', valor:dados.clientes },
        { nome:'Retornos atrasados', valor:dados.atrasados },
        { nome:'Retornos hoje', valor:dados.hoje },
        { nome:'Contatos registrados hoje', valor:dados.contatosHoje },
      ].map(item => <div key={item.nome} className={geral.indicador}><h2>{item.nome}</h2><strong>{item.valor.toLocaleString('pt-BR')}</strong></div>)}
    </section>
    <div className={styles.colunas}>
      <section aria-labelledby="titulo-carteira" className={styles.secao}>
        <h2 id="titulo-carteira">Carteira do vendedor</h2><p>Empresas sob responsabilidade de {dados.nome}.</p>
        {!dados.empresas.length ? <div className={geral.vazio}><p>{dados.clientes ? 'Nenhuma empresa nesta página.' : 'Nenhuma empresa na carteira.'}</p>
          {dados.clientes > 0 ? <Link href={endereco(1)}>Voltar para a primeira página</Link> : null}</div> :
          <div role="region" aria-label="Empresas da carteira" tabIndex={0} className={styles.rolagem}>
            <table className={styles.tabela}><thead><tr><th scope="col">Empresa</th><th scope="col">Próximo retorno</th><th scope="col">Próximo passo</th></tr></thead>
              <tbody>{dados.empresas.map(e => <tr key={e.id}><td><strong>{e.nome}</strong><span>{formatarCnpj(e.cnpj)}</span></td>
                <td>{e.retorno ? dataCivil(e.retorno) : 'Sem retorno agendado'}</td><td>{e.proximoPasso ?? 'Não registrado'}</td></tr>)}</tbody>
            </table>
          </div>}
        {dados.clientes > 0 && dados.pagina <= paginas ? <nav aria-label="Páginas da carteira" className={styles.paginacao}>
          <span>Página {dados.pagina} de {paginas}</span><div className={styles.acoes}>
            {dados.pagina > 1 ? <Button asChild variant="outline"><Link href={endereco(dados.pagina-1)}>Anterior</Link></Button> : null}
            {dados.pagina < paginas ? <Button asChild variant="outline"><Link href={endereco(dados.pagina+1)}>Próxima</Link></Button> : null}
          </div></nav> : null}
      </section>
      <section aria-labelledby="titulo-historico" className={styles.secao}>
        <h2 id="titulo-historico">Últimos atendimentos</h2><p>Até 20 registros, incluindo empresas que já saíram da carteira. Horário de Brasília.</p>
        {!dados.atividade.length ? <div className={geral.vazio}><p>Nenhum atendimento registrado.</p></div> :
          <ol className={styles.historico}>{dados.atividade.map(c => <li key={c.id}>
            <strong>{c.empresa}</strong><time dateTime={c.em}>{horario.format(new Date(c.em))}</time>
            <p>{ehTipo(c.tipo) ? ROTULO[c.tipo] : 'Contato registrado'}</p>
            <p className={styles.nota}>{c.nota ?? 'Sem anotação.'}</p>
            {c.proximoPasso ? <p><strong>Próximo passo:</strong> {c.proximoPasso}{c.retorno ? ` em ${dataCivil(c.retorno)}` : ''}</p> : null}
          </li>)}</ol>}
      </section>
    </div>
  </main>
}
