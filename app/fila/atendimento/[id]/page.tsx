import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import { CabecalhoPagina } from '@/src/components/crm/cabecalho-pagina'
import { Button } from '@/src/components/ui/button'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
import { filtrosDaConsulta } from '../../localizar/navegacao'
import { Formulario } from '../../formulario'
export default async function PaginaAtendimento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const { id } = await params
  const r = await lerAtendimento(eu.usuarioId, id)
  if (!r.ok) notFound()
  const filtros = filtrosDaConsulta(await searchParams)
  const historico = await lerHistorico(eu.usuarioId, id)
  return <main className="grid gap-6"><CabecalhoPagina titulo={r.empresa.nome} descricao="Atendimento da empresa selecionada." acoes={<Button asChild variant="outline"><Link href={urlPessoal(filtros, Number(filtros.pagina || 1), true)}>Voltar para minhas empresas</Link></Button>} /><Formulario empresa={r.empresa} fase={r.fase} filtros={filtros} contatos={historico.ok ? historico.contatos : []} /></main>
}