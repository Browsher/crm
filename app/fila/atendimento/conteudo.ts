import { notFound } from 'next/navigation'
import { exigir } from '@/src/server/autenticacao/guarda'
import { lerAtendimento } from '@/src/server/atendimento/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import type { FiltrosPessoais } from '@/src/lib/prospeccao-pessoal'
import { filtrosDaConsulta } from '../localizar/navegacao'
import type { LeituraPainelAtendimento } from './painel'

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

export const FALHA_LEITURA_ATENDIMENTO = { ok: false as const, erro: 'Não foi possível carregar o atendimento. Tente novamente.' }

export async function lerDadosPainelAtendimento(usuarioId: string, empresaId: string, filtros: FiltrosPessoais, indisponivel: string): Promise<LeituraPainelAtendimento> {
  const atendimento = await lerAtendimento(usuarioId, empresaId)
  if (!atendimento.ok) return { ok: false, erro: indisponivel }
  const historico = await lerHistorico(usuarioId, empresaId)
  if (!historico.ok) return FALHA_LEITURA_ATENDIMENTO
  return { ok: true, dados: { empresaId, empresa: atendimento.empresa, fase: atendimento.fase, contatos: historico.contatos, filtros } }
}
