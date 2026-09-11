import Link from 'next/link'
import { notFound } from 'next/navigation'
import { lerHistorico } from '@/src/features/contato/historico'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { textoDoMotivo } from '@/src/features/fila/mensagens'
import { exigir } from '@/src/server/autenticacao/guarda'
import { Ficha } from './ficha'
import { RegistrarVisita } from '../../fila/localizar/registrar-visita'
import { lerFiltrosCarteira, urlCarteira } from '../filtros'
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert'
import { Button } from '@/src/components/ui/button'

// `params` tipado na mão, nunca com tipo gerado pelo build (R-004): o typecheck
// do CI roda sem `next build`.
export default async function PaginaFicha({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const entrada = lerFiltrosCarteira(await searchParams ?? {})
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

  if (!entrada.ok) return <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6">
    <Alert variant="warning"><AlertTitle>Os filtros da Carteira são inválidos</AlertTitle><AlertDescription>Abra a ficha novamente a partir de uma busca válida.</AlertDescription></Alert>
    <Button asChild variant="outline"><Link href="/carteira">Limpar filtros</Link></Button>
  </main>

  const voltarPara = urlCarteira(entrada.filtros)
  const historico = await lerHistorico(eu.usuarioId, id)

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 p-6 max-[520px]:p-4">
      <nav aria-label="Navegação da ficha"><Link href={voltarPara} className="text-sm underline">Voltar para a carteira</Link></nav>
      <Ficha empresa={empresa} contatos={historico.ok ? historico.contatos : []}
        erroHistorico={!historico.ok} voltarPara={voltarPara} />
      <RegistrarVisita empresaId={empresa.id} />
    </main>
  )
}
