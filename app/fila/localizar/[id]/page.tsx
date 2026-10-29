import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { filtrosDaConsulta, urlAtendimento } from '../navegacao'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'
export default async function PaginaPerfil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const { id } = await params
  const filtros = filtrosDaConsulta(await searchParams)
  const r = await lerAtendimento(eu.usuarioId, id)
  redirect(r.ok ? urlAtendimento(id, filtros) : urlPessoal(filtros, Number(filtros.pagina || 1)))
}