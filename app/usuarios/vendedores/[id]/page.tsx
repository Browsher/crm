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
import { AtividadeRecente } from '../../../gestao/atividade/painel'
import { apresentarAtividade } from '../../../gestao/atividade/apresentacao'
import { lerAtividadeGestao } from '@/src/features/gestao/atividade'
import { FILTROS_ATIVIDADE } from '@/src/lib/atividade-gestao'
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
  const destaques = await lerAtividadeGestao(eu.usuarioId, { ...FILTROS_ATIVIDADE, vendedorId: dados.id }, 'destaques')
  const recorte = lerRecorteUsuarios(query, true)
  const origem = query.origem === 'gestao' ? 'gestao' : undefined
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
    <div><Button asChild variant="outline"><Link href={origem ? '/gestao' : urlUsuarios(recorte)}>{origem ? 'Voltar para Gestão' : 'Voltar para Usuários'}</Link></Button></div>
    <div><p className={styles.auxiliar}>Perfil do vendedor</p><CabecalhoPagina titulo={dados.nome} descricao={dados.email} acoes={<div className={styles.acoes}><Badge variant="success">Ativo</Badge><Button asChild variant="outline"><a href={urlPerfilUsuario(dados.id, recorte, dados.pagina, origem)}>Atualizar</a></Button></div>} /></div>
    <section aria-label="Resumo do vendedor" className={geral.resumo}>
      {[
        { nome:'Clientes em carteira', valor:dados.clientes },
        { nome:'Retornos atrasados', valor:dados.atrasados },
        { nome:'Retornos hoje', valor:dados.hoje },
        { nome:'Contatos registrados hoje', valor:dados.contatosHoje },
      ].map(item => <Card key={item.nome} className={geral.indicador}><CardContent><h2>{item.nome}</h2><strong>{item.valor.toLocaleString('pt-BR')}</strong></CardContent></Card>)}
    </section>
    <PaineisPerfil key={`consultas-${dados.id}`} vendedorId={dados.id} nome={dados.nome} recorte={recorte} origem={origem}
      empresas={dados.empresas} eventos={eventos} pagina={dados.pagina} totalEmpresas={dados.totalEmpresas} porPagina={EMPRESAS_POR_PAGINA} />
    <AtividadeRecente key={`atividade-${dados.id}`} hoje={new Date().toISOString()} destaques={apresentarAtividade(destaques)?.eventos ?? []} perfil={{ id: dados.id, nome: dados.nome }} />
  </main>
}
