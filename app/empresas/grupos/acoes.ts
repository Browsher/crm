'use server'

import { revalidatePath } from 'next/cache'
import { atualizarMetadadosGrupo, definirSituacaoGrupo, renomearGrupo } from '@/src/features/empresas/grupos'
import { validarMetadadosGrupo } from '@/src/lib/grupo-metadados'
import { exigir } from '@/src/server/autenticacao/guarda'
import { avisarSeRevalidacaoFalhar, RESULTADO_INCERTO } from '@/src/lib/edicao-administrativa'

export type EstadoGrupo = { erro: string | null; sucesso: boolean; incerto?: boolean; aviso?: string }

export async function alterarGrupoAcao(_anterior: EstadoGrupo, form: FormData): Promise<EstadoGrupo> {
  const eu = await exigir('gestor')
  const id = String(form.get('id') ?? '')
  const acao = String(form.get('acao') ?? '')
  if (!['renomear', 'desativar', 'reativar'].includes(acao)) return { erro: 'Ação desconhecida.', sucesso: false }
  const r = await (acao === 'renomear'
    ? renomearGrupo(eu.usuarioId, id, String(form.get('nome') ?? ''))
    : definirSituacaoGrupo(eu.usuarioId, id, acao === 'reativar')).catch(() => null)
  if (!r) return { erro: RESULTADO_INCERTO, incerto: true, sucesso: false }
  if (!r.ok) {
    const mensagens = {
      sem_permissao: 'Você não tem permissão para alterar este grupo.',
      nao_encontrado: 'Grupo não encontrado. Volte à lista de grupos.',
      nome_invalido: 'Informe um nome de 1 a 100 caracteres, sem caracteres de controle.',
    }
    return { erro: mensagens[r.motivo], sucesso: false }
  }
  return { erro: null, sucesso: true, ...revalidarGrupo(id) }
}

function revalidarGrupo(id: string) {
  return avisarSeRevalidacaoFalhar(() => {
    for (const caminho of ['/empresas/grupos', `/empresas/grupos/${id}`, '/fila', '/fila/localizar']) revalidatePath(caminho)
  })
}

export async function atualizarMetadadosGrupoAcao(_anterior: EstadoGrupo, form: FormData): Promise<EstadoGrupo> {
  const eu = await exigir('gestor')
  const id = String(form.get('id') ?? '')
  const validado = validarMetadadosGrupo({ descricao: form.get('descricao'), origem: form.get('origem'), criterios: form.get('criterios') })
  if (!validado.ok) return { erro: 'Informe resumo e origem com até 500 caracteres e critérios com até 2000, sem caracteres de controle.', sucesso: false }
  const r = await atualizarMetadadosGrupo(eu.usuarioId, id, validado.metadados).catch(() => null)
  if (!r) return { erro: RESULTADO_INCERTO, incerto: true, sucesso: false }
  if (!r.ok) {
    const mensagens = {
      sem_permissao: 'Você não tem permissão para alterar este grupo.',
      nao_encontrado: 'Grupo não encontrado. Volte à lista de grupos.',
      metadados_invalidos: 'Contexto inválido. Revise os textos e seus limites.',
    }
    return { erro: mensagens[r.motivo], sucesso: false }
  }
  return { erro: null, sucesso: true, ...revalidarGrupo(id) }
}
