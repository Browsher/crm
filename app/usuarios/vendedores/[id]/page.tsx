import Link from 'next/link'
import { Card, CardContent } from '@/src/components/ui/card'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import type { EventoHistoricoComercial } from '@/src/lib/historico-comercial'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { EMPRESAS_POR_PAGINA, lerPerfilVendedor, paginaDoPerfil } from '@/src/features/gestao/perfil-vendedor'
import { ehTipo, ROTULO } from '@/src/features/contato/tipos'
import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { lerRecorteUsuarios, urlPerfilUsuario, urlUsuarios } from '@/src/lib/recorte-usuarios'
import geral from '../../../gestao/gestao.module.css'
import { PaineisPerfil } from './paineis'
import styles from './perfil.module.css'

export default async function Perfil({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string,string | string[] | undefined>>
}) {
  const eu = await exigir('gestor')
  const { id } = await params
  const query = await searchParams ?? {}
  const dados = await lerPerfilVendedor(eu.usuarioId,id,paginaDoPerfil(query.pagina))
  if (!dados) notFound()
  const recorte = lerRecorteUsuarios(query, true)
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
    <div><p className={styles.auxiliar}>Perfil do vendedor</p><CabecalhoPagina titulo={dados.nome} descricao={dados.email} acoes={<div className={styles.acoes}><Badge variant="success">Ativo</Badge><Button asChild variant="outline"><a href={urlPerfilUsuario(dados.id, recorte, dados.pagina)}>Atualizar</a></Button></div>} /></div>
    <section aria-label="Resumo do vendedor" className={geral.resumo}>
      {[
        { nome:'Clientes em carteira', valor:dados.clientes },
        { nome:'Retornos atrasados', valor:dados.atrasados },
        { nome:'Retornos hoje', valor:dados.hoje },
        { nome:'Contatos registrados hoje', valor:dados.contatosHoje },
      ].map(item => <Card key={item.nome} className={geral.indicador}><CardContent><h2>{item.nome}</h2><strong>{item.valor.toLocaleString('pt-BR')}</strong></CardContent></Card>)}
    </section>
    <PaineisPerfil key={dados.id} vendedorId={dados.id} nome={dados.nome} recorte={recorte}
      empresas={dados.empresas} eventos={eventos} pagina={dados.pagina} totalEmpresas={dados.totalEmpresas} porPagina={EMPRESAS_POR_PAGINA} />
  </main>
}
