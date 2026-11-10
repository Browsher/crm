import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import { filtrosDaConsulta } from '../localizar/navegacao'

export type PropsAtendimento = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function lerPaginaAtendimento({ params, searchParams }: PropsAtendimento) {
  const eu = await exigir('vendedor')
  const { id } = await params
  const resultado = await lerAtendimento(eu.usuarioId, id)
  if (!resultado.ok) notFound()
  const filtros = filtrosDaConsulta(await searchParams)
  const historico = await lerHistorico(eu.usuarioId, id)
  return { empresaId: id, empresa: resultado.empresa, fase: resultado.fase, filtros, contatos: historico.ok ? historico.contatos : [] }
}
