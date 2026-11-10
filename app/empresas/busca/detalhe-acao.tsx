'use server'

import type { ReactNode } from 'react'
import { exigir } from '@/src/server/autenticacao/guarda'
import { repositorioBusca } from '@/src/features/busca-empresas/repositorio'
import { ConteudoBusca } from './conteudo'
import { lerDetalhesEmpresa } from '@/src/server/empresas/detalhes'
import { lerAtendimento, lerResumosBusca } from '@/src/server/atendimento/consulta'
import { lerHistorico } from '@/src/features/contato/historico'
import type { DadosPainelAtendimento } from '@/app/fila/atendimento/painel'
import type { ReferenciaEmpresa } from '@/src/lib/empresa-visual'
import { EmpresaDetalhes } from '@/src/components/crm/empresa-detalhes'

// Leitura da busca persistida. Não reserva limite nem chama o fornecedor.
export async function lerDetalheBuscaAcao(id: string, historicoVendedor = false): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('usuario')
  const repo = repositorioBusca(eu.usuarioId)
  try {
    const busca = await repo.ler(id)
    if (!busca) return { ok: false, erro: 'Esta busca não está disponível para você. Feche e confira o histórico.' }
    const gestor = eu.papel === 'gestor'
    const limite = gestor ? null : await repo.meuLimite()
    const resumos = gestor ? null : await lerResumosBusca(eu.usuarioId, busca.id)
    if (historicoVendedor && resumos?.ok === false) return { ok: false, erro: 'Não foi possível atualizar as empresas da busca. Tente novamente.' }
    return { ok: true, conteudo: <ConteudoBusca busca={busca} gestor={gestor} bloqueada={Boolean(limite?.pausado)} resumos={resumos?.ok ? resumos.empresas : []} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a busca. Tente novamente.' }
  }
}

export async function lerAtendimentoBuscaAcao(buscaId: string, empresaId: string): Promise<{ ok: true; dados: DadosPainelAtendimento } | { ok: false; erro: string }> {
  const eu = await exigir('vendedor')
  const indisponivel = { ok: false as const, erro: 'Esta empresa não está disponível para atendimento nesta busca.' }
  const falha = { ok: false as const, erro: 'Não foi possível carregar o atendimento. Tente novamente.' }
  try {
    const resumos = await lerResumosBusca(eu.usuarioId, buscaId)
    if (!resumos.ok) return falha
    if (!resumos.empresas.some(e => e.id === empresaId)) return indisponivel
    const atendimento = await lerAtendimento(eu.usuarioId, empresaId)
    if (!atendimento.ok) return indisponivel
    const historico = await lerHistorico(eu.usuarioId, empresaId)
    if (!historico.ok) return falha
    return { ok: true, dados: { empresaId, empresa: atendimento.empresa, fase: atendimento.fase, contatos: historico.contatos, filtros: { origem: 'banco' } } }
  } catch { return falha }
}

export async function lerEmpresaBuscaAcao(id: string, cnpj: string): Promise<{ ok: true; conteudo: ReactNode } | { ok: false; erro: string }> {
  const eu = await exigir('usuario')
  try {
    const r = await lerDetalhesEmpresa(eu.usuarioId, { tipo: 'busca', buscaId: id, cnpj })
    if (!r.ok) return { ok: false, erro: 'Esta empresa não está disponível para você.' }
    return { ok: true, conteudo: <EmpresaDetalhes empresa={r.dados} /> }
  } catch {
    return { ok: false, erro: 'Não foi possível carregar a empresa. Tente novamente.' }
  }
}

export async function lerDetalhesEmpresaAcao(referencia: ReferenciaEmpresa) {
  const eu = await exigir('usuario')
  return lerDetalhesEmpresa(eu.usuarioId, referencia)
}
