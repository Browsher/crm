import Link from 'next/link'
import { Card, CardContent } from '@/src/components/ui/card'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { HistoricoComercial } from '@/src/components/crm/historico-comercial'
import type { EventoHistoricoComercial } from '@/src/lib/historico-comercial'
import { EstadoVazio } from '@/src/components/crm/estado-vazio'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/src/components/ui/table'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { EMPRESAS_POR_PAGINA, lerPerfilVendedor, paginaDoPerfil } from '@/src/features/gestao/perfil-vendedor'
import { formatarCnpj } from '@/src/features/empresas/formato'
import { ehTipo, ROTULO } from '@/src/features/contato/tipos'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { lerRecorteUsuarios, urlPerfilUsuario, urlUsuarios } from '@/src/lib/recorte-usuarios'
import geral from '../../../gestao/gestao.module.css'
import styles from './perfil.module.css'

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
  const paginas = Math.max(1, Math.ceil(dados.totalEmpresas / EMPRESAS_POR_PAGINA))
  const recorte = lerRecorteUsuarios(query, true)
  const endereco = (pagina: number) => urlPerfilUsuario(dados.id, recorte, pagina)
  const eventos: EventoHistoricoComercial[] = dados.atividade.map(contato => {
    const resultado = ehTipo(contato.tipo) ? ROTULO[contato.tipo] : contato.tipo
    return {
      id: contato.id,
      empresa: contato.empresa,
      natureza: contato.natureza,
      titulo: contato.natureza === 'atividade_sem_ligacao' ? 'Atividade sem ligação' : resultado,
      criadoEm: contato.em,
      autor: dados.nome,
      nota: contato.nota,
      resultado,
      ...(contato.proximoPasso ? { proximoPasso: { descricao: contato.proximoPasso, data: contato.retorno } } : {}),
    }
  })
  return <main className={geral.pagina}>
    <div><Button asChild variant="outline"><Link href={urlUsuarios(recorte)}>Voltar para Usuários</Link></Button></div>
    <div><p className={styles.auxiliar}>Perfil do vendedor</p><CabecalhoPagina titulo={dados.nome} descricao={dados.email} acoes={<div className={styles.acoes}><Badge variant="success">Ativo</Badge><Button asChild variant="outline"><a href={endereco(dados.pagina)}>Atualizar</a></Button></div>} /></div>
    <section aria-label="Resumo do vendedor" className={geral.resumo}>
      {[
        { nome:'Clientes em carteira', valor:dados.clientes },
        { nome:'Retornos atrasados', valor:dados.atrasados },
        { nome:'Retornos hoje', valor:dados.hoje },
        { nome:'Contatos registrados hoje', valor:dados.contatosHoje },
      ].map(item => <Card key={item.nome} className={geral.indicador}><CardContent><h2>{item.nome}</h2><strong>{item.valor.toLocaleString('pt-BR')}</strong></CardContent></Card>)}
    </section>
    <div className={styles.colunas}>
      <Card role="region" aria-labelledby="titulo-empresas" className={styles.secao}><CardContent>
        <h2 id="titulo-empresas">Empresas do vendedor</h2><p>Empresas vinculadas a {dados.nome}.</p>
        {!dados.empresas.length ? <EstadoVazio nivelTitulo={3} titulo={dados.totalEmpresas ? 'Nenhuma empresa nesta página' : 'Nenhuma empresa vinculada'} descricao="As empresas vinculadas ao vendedor aparecem aqui." acao={dados.totalEmpresas > 0 ? { rotulo: 'Voltar para a primeira página', href: endereco(1), variante: 'outline' } : undefined} /> :
          <div role="region" aria-label="Empresas do vendedor" tabIndex={0} className={styles.rolagem}>
            <Table className={styles.tabela}><TableHeader><TableRow><TableHead scope="col">Empresa</TableHead><TableHead scope="col">Próximo retorno</TableHead><TableHead scope="col">Próximo passo</TableHead></TableRow></TableHeader>
              <TableBody>{dados.empresas.map(e => <TableRow key={e.id}><TableCell><strong>{e.nome}</strong><span>{formatarCnpj(e.cnpj)}</span></TableCell>
                <TableCell>{e.retorno ? dataCivil(e.retorno) : 'Sem retorno agendado'}</TableCell><TableCell>{e.proximoPasso ?? 'Não registrado'}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>}
        {dados.totalEmpresas > 0 && dados.pagina <= paginas ? <nav aria-label="Páginas das empresas" className={styles.paginacao}>
          <span>Página {dados.pagina} de {paginas}</span><div className={styles.acoes}>
            {dados.pagina > 1 ? <Button asChild variant="outline"><Link href={endereco(dados.pagina-1)}>Anterior</Link></Button> : null}
            {dados.pagina < paginas ? <Button asChild variant="outline"><Link href={endereco(dados.pagina+1)}>Próxima</Link></Button> : null}
          </div></nav> : null}
      </CardContent></Card>
      <Card role="region" aria-labelledby="titulo-historico" className={styles.secao}><CardContent>
        <h2 id="titulo-historico">Últimos atendimentos</h2><p>Até 20 registros, incluindo empresas atendidas anteriormente. Horário de Brasília.</p>
        {!dados.atividade.length ? <EstadoVazio nivelTitulo={3} titulo="Nenhum atendimento registrado" descricao="Os últimos atendimentos deste vendedor aparecem aqui." /> :
          <HistoricoComercial eventos={eventos} mostrarEmpresa />}
      </CardContent></Card>
    </div>
  </main>
}
