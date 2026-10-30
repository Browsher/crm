import { redirect } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerMinhasEmpresas } from '@/src/features/fila/consulta'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { CentralProspeccao } from './central'
import { filtrosDaConsulta, urlAtendimento } from './localizar/navegacao'
import { urlPessoal } from '@/src/lib/prospeccao-pessoal'

export default async function PaginaFila({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const eu = await exigir('vendedor')
  const params = await searchParams
  if (Object.keys(params).length) {
    // A reserva histórica só identifica um bookmark inequívoco; nunca adquire nada.
    if (params.atendimento === '1') {
      const antigas = await lerMinhasEmpresas(eu.usuarioId)
      if (antigas.ok && antigas.reserva) {
        const atual = await lerAtendimento(eu.usuarioId, antigas.reserva.id)
        if (atual.ok) redirect(urlAtendimento(antigas.reserva.id, filtrosDaConsulta(params)))
      }
    }
    const filtros = filtrosDaConsulta(params)
    redirect(urlPessoal(filtros, Number(filtros.pagina || 1)))
  }
  return <CentralProspeccao />
}