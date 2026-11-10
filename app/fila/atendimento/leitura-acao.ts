'use server'

import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { repositorioGoogle } from '@/src/features/google/repositorio'
import { FALHA_LEITURA_ATENDIMENTO, lerDadosPainelAtendimento } from './conteudo'
import type { LeituraPainelAtendimento } from './painel'

type OrigemAtendimento = { tipo: 'recentes' } | { tipo: 'google'; pedidoId: string; pagina: number }

export async function lerAtendimentoDaListaAcao(origem: OrigemAtendimento, empresaId: string): Promise<LeituraPainelAtendimento> {
  const eu = await exigir('vendedor')
  const indisponivel = 'Esta empresa não está disponível para atendimento nesta lista.'
  try {
    if (origem?.tipo === 'recentes') {
      const recentes = await repositorioBusca(eu.usuarioId).empresasRecentes()
      if (recentes.some(empresa => empresa.empresaId === empresaId)) {
        return await lerDadosPainelAtendimento(eu.usuarioId, empresaId, { origem: 'banco' }, indisponivel)
      }
    }
    if (origem?.tipo === 'google' && typeof origem.pedidoId === 'string' && Number.isInteger(origem.pagina) && origem.pagina >= 1 && origem.pagina <= 100) {
      const entrega = await repositorioGoogle(eu.usuarioId).detalhe(origem.pedidoId, origem.pagina)
      if (entrega?.plano.vendedor_id === eu.usuarioId && entrega.resultados.some(empresa => empresa.empresa_id === empresaId)) {
        return await lerDadosPainelAtendimento(eu.usuarioId, empresaId, { origem: 'google' }, indisponivel)
      }
    }
    return { ok: false, erro: indisponivel }
  } catch { return FALHA_LEITURA_ATENDIMENTO }
}
