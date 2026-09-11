import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Ficha } from './ficha'
import { RegistrarVisita } from '../../fila/localizar/registrar-visita'
import { lerFiltrosCarteira, urlCarteira } from '../filtros'
import { lerFiltrosMeuDia, urlMeuDia } from '../../meu-dia/agenda'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'

// `params` tipado na mão, nunca com tipo gerado pelo build (R-004): o typecheck
// do CI roda sem `next build`.
export default async function PaginaFicha({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const query = await searchParams ?? {}
  const doMeuDia = query.de === 'meu-dia'
  const entradaMeuDia = doMeuDia ? lerFiltrosMeuDia(query) : null
  const entradaCarteira = doMeuDia ? null : lerFiltrosCarteira(query)
  const eu = await exigir('usuario')
  const r = await lerMinhasEmpresas(eu.usuarioId)

  if (!r.ok) {
    return (
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6">
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{textoDoMotivo(r.motivo)}</p>
      </main>
    )
  }

  // Empresa fora da carteira é 404, e não "sem permissão": a existência dela
  // não é informação que o vendedor deva receber.
  const empresa = r.carteira.find((e) => e.id === id)
  if (!empresa) notFound()

  // Filtros da Carteira inválidos bloqueiam a ficha, como antes. Filtros do
  // Meu dia inválidos não bloqueiam: a origem é conhecida (lista fechada) e o
  // voltar cai para a agenda sem filtro, um literal fixo, nunca a query.
  if (entradaCarteira && !entradaCarteira.ok) return <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6">
    <Alert variant="warning"><AlertTitle>Os filtros da Carteira são inválidos</AlertTitle><AlertDescription>Abra a ficha novamente a partir de uma busca válida.</AlertDescription></Alert>
    <Button asChild variant="outline"><Link href="/carteira">Limpar filtros</Link></Button>
  </main>

  // A origem é valor de lista fechada e os filtros passam pelo validador
  // correspondente: nenhuma URL vinda da query vira destino de volta.
  let voltarPara: string
  if (doMeuDia) {
    voltarPara = entradaMeuDia?.ok ? urlMeuDia(entradaMeuDia.filtros) : '/meu-dia'
  } else {
    // Chegou até aqui sem ter voltado no `if` acima, então `entradaCarteira.ok` é sempre `true`.
    voltarPara = entradaCarteira?.ok ? urlCarteira(entradaCarteira.filtros) : '/carteira'
  }
  const rotuloVoltar = doMeuDia ? 'Voltar para o Meu dia' : 'Voltar para a carteira'
  const historico = await lerHistorico(eu.usuarioId, id)

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6 max-[520px]:p-4">
      <nav aria-label="Navegação da ficha"><Link href={voltarPara} className="text-sm underline">{rotuloVoltar}</Link></nav>
      <Ficha empresa={empresa} contatos={historico.ok ? historico.contatos : []}
        erroHistorico={!historico.ok} voltarPara={voltarPara} />
      <RegistrarVisita empresaId={empresa.id} />
    </main>
  )
}
